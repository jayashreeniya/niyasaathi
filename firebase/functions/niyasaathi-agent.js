// Firebase Functions for NIYAsaathi Backend
// This file replicates the Flask backend functionality in Node.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Firebase Admin is already initialized in the main functions file
const db = admin.firestore();

// Load environment variables
const openaiApiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
const twilioAccountSid = functions.config().twilio?.account_sid || process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = functions.config().twilio?.auth_token || process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = functions.config().twilio?.phone_number || process.env.TWILIO_PHONE_NUMBER;

// Azure Speech Configuration (for future TTS features)
const azureSpeechKey = functions.config().azure?.speech_key || process.env.AZURE_SPEECH_KEY;
const azureSpeechRegion = functions.config().azure?.speech_region || process.env.AZURE_SPEECH_REGION;

// Initialize Twilio client if credentials are available
let twilioClient = null;
if (twilioAccountSid && twilioAuthToken && twilioAccountSid !== 'TWILIO_SID') {
  try {
    const twilio = require('twilio');
    twilioClient = new twilio(twilioAccountSid, twilioAuthToken);
  } catch (error) {
    console.warn('Failed to initialize Twilio client:', error.message);
  }
}

// Load JSON data files
const questions = require('./data/questions.json');
const interventions = require('./data/interventions.json');
const lonelinessScript = require('./data/loneliness_script.json');

// Utility functions
function generateToken(userId) {
  const jwt = require('jsonwebtoken');
  const secret = functions.config().jwt?.secret || process.env.JWT_SECRET_KEY || 'your-jwt-secret-key-here';
  
  const payload = {
    user_id: userId,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

function verifyToken(token) {
  const jwt = require('jsonwebtoken');
  const secret = functions.config().jwt?.secret || process.env.JWT_SECRET_KEY || 'your-jwt-secret-key-here';
  
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (error) {
    throw new Error('Invalid token');
  }
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getUserData(userId) {
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (error) {
    console.error('Error getting user data from Firestore:', error);
  }
  
  // Return default user data if not found
  return {
    id: userId,
    phone_number: '',
    current_stage: 'screening',
    current_question: 'q1',
    branch: null,
    intervention_type: null,
    conversation_history: [],
    last_coach_message: '',
    last_updated: new Date().toISOString()
  };
}

async function saveUserData(userId, userData) {
  try {
    await db.collection('users').doc(userId).set(userData);
    return true;
  } catch (error) {
    console.error('Error saving user data to Firestore:', error);
    return false;
  }
}

async function sendSmsViaTwilio(toNumber, message) {
  if (!twilioClient) {
    console.log('Twilio credentials not configured. SMS will not be sent.');
    return false;
  }
  
  try {
    await twilioClient.messages.create({
      body: message,
          from: twilioPhoneNumber,
      to: toNumber
    });
    console.log(`SMS sent successfully to ${toNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    return false;
  }
}

// AI Agent class (converted from Python)
class NIYAsaathiAgent {
  constructor(openaiApiKey) {
    this.openaiClient = require('openai');
    this.openai = new this.openaiClient({ apiKey: openaiApiKey });
    this.questions = questions;
    this.interventions = interventions;
    this.lonelinessScript = lonelinessScript;
  }
  
  findQuestionById(questionId) {
    for (const section of Object.values(this.questions)) {
      if (section[questionId]) {
        return section[questionId];
      }
    }
    return null;
  }
  
  findScriptItemById(itemId) {
    return this.lonelinessScript.find(item => item.id === itemId);
  }
  
  getUserContext(userData) {
    let context = `User: ${userData.phone_number || 'Unknown'}\n`;
    context += `Current stage: ${userData.current_stage || 'screening'}\n`;
    context += `Current question: ${userData.current_question || 'q1'}\n`;
    context += `Branch: ${userData.branch || 'none'}\n`;
    context += `Script progress: ${userData.script_progress || 0}\n`;
    
    if (userData.conversation_history) {
      context += '\nRecent conversation:\n';
      const recentHistory = userData.conversation_history.slice(-5); // Last 5 exchanges
      for (const entry of recentHistory) {
        context += `Coach: ${entry.coach_message || ''}\n`;
        context += `User: ${entry.user_message || ''}\n`;
      }
    }
    
    return context;
  }
  
  buildSystemPrompt(userData) {
    const basePrompt = `You are Niyasaathi, an empathetic loneliness coach by Niya. You sound like a gentle Indian therapist or life coach.

Your core principles:
1. Always maintain a warm, supportive, and validating tone
2. Never dismiss or minimize user's feelings
3. Be direct about recommending professional help when needed
4. Focus on actionable, practical suggestions
5. Maintain appropriate boundaries
6. Never provide medical advice

Your conversation style:
- Kind, validating, and soft
- Don't rush - let users speak and feel heard
- Probe gently and only if the user is ready
- Use the structured conversation flow provided
- Remember past interactions and continue from where you left off

IMPORTANT:
- When asking questions or giving prompts, use the exact wording from the provided script (JSON) whenever possible, or build directly on it. Do not paraphrase or reword unless necessary for clarity.
- Avoid over-apologizing or saying 'I'm sorry' for every user response. Instead, validate and gently encourage the user to share more.
- Only add empathy or transitions if the script does not already include them.

Current conversation context:
${this.getUserContext(userData)}

Your response should:
1. Use the exact script prompt for the next step, or build on it with gentle, validating language.
2. Avoid excessive apologies; focus on validation and curiosity.
3. If the user has completed a section, provide appropriate intervention guidance.
4. Keep responses conversational and warm.
5. If the user seems to need immediate professional help, gently suggest it.

Remember: You are Niyasaathi, not Niva. Use this name consistently.`;
    
    return basePrompt;
  }
  
  determineNextQuestion(userData, userResponse) {
    const currentQuestionId = userData.current_question || 'q1';
    const currentQuestion = this.findQuestionById(currentQuestionId);
    
    if (!currentQuestion) {
      return 'q1';
    }
    
    // Check if user response indicates a specific branch
    if (currentQuestion.type === 'yes_no') {
      const positiveWords = ['yes', 'yeah', 'yep', 'sure', 'okay'];
      const isPositive = positiveWords.some(word => userResponse.toLowerCase().includes(word));
      
      if (isPositive) {
        return currentQuestion.next || 'q2';
      } else {
        // If no to social anxiety question, move to general intervention
        if (currentQuestionId === 'q10') {
          return 'intervention_general_loneliness';
        } else {
          return currentQuestion.next || 'q2';
        }
      }
    }
    
    // For open-ended questions, move to next question
    return currentQuestion.next || 'q2';
  }

  _determineNextScriptItem(userData, userMessage) {
    const currentScriptProgress = userData.script_progress || 0;
    const currentBranch = userData.branch || 'general';
    
    // Get current script item
    if (currentScriptProgress < this.lonelinessScript.length) {
      const currentItem = this.lonelinessScript[currentScriptProgress];
    } else {
      // If we've reached the end, check for branch-specific interventions
      if (currentBranch === 'relationship_loss') {
        return 'intervention_relationship_loss';
      } else {
        return 'intervention_general_loneliness';
      }
    }

    const currentItem = this.lonelinessScript[currentScriptProgress];
    if (!currentItem) {
      return 'script_0'; // Default to the first script item if progress is out of bounds
    }

    // Check if we're at the explore_causes_intro question and need to branch
    if (currentItem.id === 'explore_causes_intro') {
      // Check for specific loneliness causes in user response
      const userResponseLower = userMessage.toLowerCase();
      
      // Relationship changes
      const relationshipKeywords = ['breakup', 'divorce', 'separation', 'lost', 'ended', 'relationship', 'partner', 'spouse', 'ex', '1', 'one', 'first'];
      if (relationshipKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'relationship_loss';
        // Find the relationship loss followup intro
        for (let i = 0; i < this.lonelinessScript.length; i++) {
          const item = this.lonelinessScript[i];
          if (item.id === 'relationship_loss_followup_intro') {
            userData.script_progress = i;
            return `script_${i}`;
          }
        }
      }
      
      // Moving
      const movingKeywords = ['moving', 'moved', 'new city', 'new place', 'relocated', '2', 'two', 'second'];
      if (movingKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'moving';
        // Find the moving followup intro
        for (let i = 0; i < this.lonelinessScript.length; i++) {
          const item = this.lonelinessScript[i];
          if (item.id === 'moving_followup_intro') {
            userData.script_progress = i;
            return `script_${i}`;
          }
        }
      }
      
      // Social anxiety
      const socialAnxietyKeywords = ['social anxiety', 'anxiety', 'difficulty', 'initiating', 'maintaining', 'connections', '3', 'three', 'third'];
      if (socialAnxietyKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'social_anxiety';
        // Find the social anxiety followup intro
        for (let i = 0; i < this.lonelinessScript.length; i++) {
          const item = this.lonelinessScript[i];
          if (item.id === 'social_anxiety_followup_intro') {
            userData.script_progress = i;
            return `script_${i}`;
          }
        }
      }
      
      // Lack of emotional intimacy
      const emotionalIntimacyKeywords = ['emotional intimacy', 'surrounded', 'not feeling close', '4', 'four', 'fourth'];
      if (emotionalIntimacyKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'emotional_intimacy';
        // Find the emotional intimacy followup intro
        for (let i = 0; i < this.lonelinessScript.length; i++) {
          const item = this.lonelinessScript[i];
          if (item.id === 'emotional_intimacy_followup_intro') {
            userData.script_progress = i;
            return `script_${i}`;
          }
        }
      }
      
      // Different life stage
      const differentLifeStageKeywords = ['different life stage', 'out of sync', 'peers', 'single', 'married', '5', 'five', 'fifth'];
      if (differentLifeStageKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'different_life_stage';
        return 'intervention_different_life_stage';
      }
      
      // Digital disconnection
      const digitalDisconnectionKeywords = ['digital', 'online', 'internet', 'social media', '6', 'six', 'sixth'];
      if (digitalDisconnectionKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'digital_disconnection';
        return 'intervention_digital_disconnection';
      }
      
      // Unprocessed grief
      const unprocessedGriefKeywords = ['grief', 'loss', 'mourn', '7', 'seven', 'seventh'];
      if (unprocessedGriefKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'unprocessed_grief';
        return 'intervention_unprocessed_grief';
      }
      
      // Feeling misunderstood
      const feelingMisunderstoodKeywords = ['misunderstood', 'hide parts', '8', 'eight', 'eighth'];
      if (feelingMisunderstoodKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'feeling_misunderstood';
        return 'intervention_feeling_misunderstood';
      }
      
      // Not feeling chosen
      const notFeelingChosenKeywords = ['not feeling chosen', 'reaching out', 'no one checks', '9', 'nine', 'ninth'];
      if (notFeelingChosenKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'not_feeling_chosen';
        return 'intervention_not_feeling_chosen';
      }
      
      // Low self-worth
      const lowSelfWorthKeywords = ['low self-worth', 'not interesting', 'not worthy', '10', 'ten', 'tenth'];
      if (lowSelfWorthKeywords.some(keyword => userResponseLower.includes(keyword))) {
        userData.branch = 'low_self_worth';
        return 'intervention_low_self_worth';
      }
    }

    // Check if we're in a follow-up section and need to transition to intervention
    const currentSection = currentItem.section || '';
    if (currentSection.startsWith('Follow-up:')) {
      // Check if the next item is in a different follow-up section or non-follow-up section
      const nextProgress = currentScriptProgress + 1;
      if (nextProgress < this.lonelinessScript.length) {
        const nextItem = this.lonelinessScript[nextProgress];
        const nextSection = nextItem.section || '';
        
        // If we're moving to a different follow-up section, transition to intervention
        if (nextSection !== currentSection) {
          // Map current branch to appropriate intervention based on the follow-up section
          if (currentSection.includes('Changes in Relationships')) {
            return 'intervention_relationship_loss';
          } else if (currentSection.includes('After Moving')) {
            return 'intervention_moving';
          } else if (currentSection.includes('Social Anxiety')) {
            return 'intervention_social_anxiety';
          } else if (currentSection.includes('Emotional Intimacy')) {
            return 'intervention_emotional_intimacy';
          } else if (currentSection.includes('Different Life Stage')) {
            return 'intervention_different_life_stage';
          } else if (currentSection.includes('Digital Disconnection')) {
            return 'intervention_digital_disconnection';
          } else if (currentSection.includes('Unprocessed Grief')) {
            return 'intervention_unprocessed_grief';
          } else if (currentSection.includes('Feeling Misunderstood')) {
            return 'intervention_feeling_misunderstood';
          } else if (currentSection.includes('Not Feeling Chosen')) {
            return 'intervention_not_feeling_chosen';
          } else if (currentSection.includes('Low Self-Worth')) {
            return 'intervention_low_self_worth';
          } else {
            return 'intervention_general_loneliness';
          }
        }
      }
    }

    // Check if the current item is a branching question
    if (currentItem.type === 'yes_no') {
      const positiveWords = ['yes', 'yeah', 'yep', 'sure', 'okay'];
      const isPositive = positiveWords.some(word => userMessage.toLowerCase().includes(word));

      if (isPositive) {
        return currentItem.next || 'script_0'; // Default to the first script item if no next
      } else {
        // If no to branching question, move to the next script item
        return 'script_' + (currentScriptProgress + 1);
      }
    }

    // For open-ended questions, move to the next script item
    return 'script_' + (currentScriptProgress + 1);
  }

  _getInterventionStage(interventionType, stageIndex = 0) {
    if (!this.interventions[interventionType]) {
      return null;
    }
    
    const intervention = this.interventions[interventionType];
    if (!intervention.intervention_stages || stageIndex >= intervention.intervention_stages.length) {
      return null;
    }
    
    return intervention.intervention_stages[stageIndex];
  }

  _getNextInterventionStage(userData, userMessage) {
    const interventionType = userData.intervention_type;
    const intervention = this.interventions[interventionType];

    if (!intervention) {
      return null;
    }

    const currentStageIndex = userData.intervention_stage_index || 0;
    const nextStage = intervention.intervention_stages[currentStageIndex];

    if (!nextStage) {
      return null;
    }

    // Check if the next stage is a branching question
    if (nextStage.type === 'yes_no') {
      const positiveWords = ['yes', 'yeah', 'yep', 'sure', 'okay'];
      const isPositive = positiveWords.some(word => userMessage.toLowerCase().includes(word));

      if (isPositive) {
        return nextStage.next || null; // Default to null if no next
      } else {
        // If no to branching question, move to the next stage
        return 'intervention_' + interventionType + '_' + (currentStageIndex + 1);
      }
    }

    // For open-ended questions, move to the next stage
    return 'intervention_' + interventionType + '_' + (currentStageIndex + 1);
  }

  _createActionItem(userData, stage) {
    if (!userData.action_items) {
      userData.action_items = [];
    }
    
    const now = new Date();
    const actionItem = {
      id: `${stage.stage}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`,
      type: stage.type,
      title: stage.title,
      description: stage.prompt,
      duration: stage.duration || '',
      reminder_after: stage.reminder_after || '8 hours',
      follow_up_question: stage.follow_up_question || '',
      created_at: now.toISOString(),
      due_date: this._calculateDueDate(stage.reminder_after || '8 hours'),
      completed: false,
      reminder_sent: false,
      daily_prompts: stage.daily_prompts || []
    };
    
    userData.action_items.push(actionItem);
  }

  _calculateDueDate(reminderAfter) {
    const now = new Date();
    
    if (reminderAfter.includes('hours')) {
      const hours = parseInt(reminderAfter.split(' ')[0]);
      return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
    } else if (reminderAfter.includes('days')) {
      const days = parseInt(reminderAfter.split(' ')[0]);
      return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    } else if (reminderAfter.includes('week')) {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Default to 8 hours
      return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    }
  }

  _getInterventionResponse(interventionType) {
    if (!this.interventions[interventionType]) {
      interventionType = 'general_loneliness';
    }
    
    const intervention = this.interventions[interventionType];
    
    // Check if this intervention has stages (new format)
    if (intervention.intervention_stages) {
      // Start with the first stage
      const stages = intervention.intervention_stages;
      if (stages.length > 0) {
        const firstStage = stages[0];
        let response = `${intervention.title || 'Support'}\n\n`;
        response += `${intervention.description || ''}\n\n`;
        response += `${firstStage.prompt}`;
        
        // Store intervention context for multi-stage flow
        return response;
      }
    }
    
    // Fallback to old format
    let response = `${intervention.title || 'Support'}\n\n`;
    response += `${intervention.message || intervention.description || ''}\n\n`;
    
    response += "Here are some gentle suggestions that might help:\n\n";
    const suggestions = intervention.suggestions || [];
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      response += `${i + 1}. ${suggestion.title}: ${suggestion.description}\n`;
      response += `   Action: ${suggestion.action}\n\n`;
    }
    
    response += `\n${intervention.follow_up || 'How are you feeling about these suggestions?'}`;
    
    return response;
  }

  _getScriptResponse(scriptProgress) {
    if (scriptProgress >= this.lonelinessScript.length) {
      return "Thank you for sharing that with me. How are you feeling right now?";
    }
    
    const scriptItem = this.lonelinessScript[scriptProgress];
    return scriptItem.prompt || 'How are you feeling?';
  }

  _checkForActionItems(userData, currentItem) {
    const actionItems = [];
    
    if (currentItem.action_item) {
      // Create action item for nudge system
      const now = new Date();
      const actionItem = {
        id: currentItem.id,
        type: currentItem.id.includes('reflection') ? 'reflection' : 'exercise',
        description: currentItem.prompt || '',
        created_at: now.toISOString(),
        due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Default to 1 day
        completed: false,
        reminder_sent: false
      };
      actionItems.push(actionItem);
    }
    
    return actionItems;
  }

  _updateActionItems(userData, actionItems) {
    if (!userData.action_items) {
      userData.action_items = [];
    }
    
    userData.action_items.push(...actionItems);
  }

  getFollowUpMessage(userData) {
    const interventionType = userData.intervention_type || 'general_loneliness';
    const intervention = this.interventions[interventionType] || this.interventions['general_loneliness'];
    
    return intervention.follow_up || "How are you feeling today? Remember, I'm here to support you.";
  }

  getActionItemReminders(userData) {
    if (!userData.action_items) {
      return [];
    }
    
    const currentTime = new Date();
    const reminders = [];
    
    for (const item of userData.action_items) {
      if (!item.completed && !item.reminder_sent) {
        const dueDate = new Date(item.due_date);
        if (currentTime >= dueDate) {
          reminders.push({
            id: item.id,
            type: item.type,
            title: item.title || 'Practice Reminder',
            message: this._createReminderMessage(item),
            action_item: item
          });
        }
      }
    }
    
    return reminders;
  }

  _createReminderMessage(actionItem) {
    const title = actionItem.title || 'Practice';
    const description = actionItem.description || '';
    
    if (actionItem.type === 'self_guided') {
      if (actionItem.title && actionItem.title.toLowerCase().includes('reflection')) {
        return `Hi there! 🌟 Just a gentle reminder about your reflection practice: ${title}. Take a few moments when you're ready - there's no rush. Remember, this is about witnessing your experience honestly.`;
      } else if (actionItem.title && actionItem.title.toLowerCase().includes('reclaiming')) {
        return `Hello! 💫 Wondering how your reclaiming practice is going? ${title}. Remember, this is about making something yours again - no pressure, just gentle exploration.`;
      } else if (actionItem.title && actionItem.title.toLowerCase().includes('journal')) {
        return `Hi! 📝 How's your weekly journal practice feeling? ${title}. Even one question answered is progress. You're doing great!`;
      }
    } else {
      return `Hi there! Just a gentle reminder about: ${title}. ${description}`;
    }
  }

  sendFollowUpCheckin(userData, actionItemId) {
    if (!userData.action_items) {
      return null;
    }
    
    for (const item of userData.action_items) {
      if (item.id === actionItemId) {
        const followUpQuestion = item.follow_up_question || '';
        if (followUpQuestion) {
          return `Hi there! I wanted to check in about your practice: ${item.title || ''}. ${followUpQuestion}`;
        }
        break;
      }
    }
    
    return null;
  }

  getDailyJournalPrompt(userData, dayNumber) {
    if (!userData.action_items) {
      return null;
    }
    
    for (const item of userData.action_items) {
      if (item.type === 'self_guided' && item.title && item.title.toLowerCase().includes('journal')) {
        const dailyPrompts = item.daily_prompts || [];
        if (dayNumber - 1 >= 0 && dayNumber - 1 < dailyPrompts.length) {
          return `Day ${dayNumber} Journal Prompt: ${dailyPrompts[dayNumber - 1]}`;
        }
        break;
      }
    }
    
    return null;
  }

  markActionItemCompleted(userData, actionItemId) {
    if (!userData.action_items) {
      return;
    }
    
    for (const item of userData.action_items) {
      if (item.id === actionItemId) {
        item.completed = true;
        item.completed_at = new Date().toISOString();
        break;
      }
    }
  }

  startLonelinessScript(userData) {
    userData.current_stage = 'loneliness_script';
    userData.script_progress = 0;
    userData.branch = 'general';
    
    if (this.lonelinessScript.length > 0) {
      const firstItem = this.lonelinessScript[0];
      const response = firstItem.prompt || 'Hi there. How are you feeling today?';
      
      // Check for action items
      const actionItems = this._checkForActionItems(userData, firstItem);
      if (actionItems.length > 0) {
        this._updateActionItems(userData, actionItems);
      }
      
      return {
        response: response,
        current_stage: 'loneliness_script',
        script_progress: 0,
        branch: 'general',
        action_items: actionItems,
        user_data: userData
      };
    } else {
      return {
        response: "Hi there. How are you feeling today?",
        current_stage: 'loneliness_script',
        script_progress: 0,
        branch: 'general',
        action_items: [],
        user_data: userData
      };
    }
  }
  
  async processMessage(userData, userMessage) {
    try {
      // Ensure conversation history exists
      if (!userData.conversation_history) userData.conversation_history = [];
      userData.conversation_history.push({
        timestamp: new Date().toISOString(),
        coach_message: userData.last_coach_message || '',
        user_message: userMessage
      });
      if (!('user_preferred_name' in userData)) userData.user_preferred_name = null;
      let response = '';
      let actionItems = [];
      console.log('[DEBUG] processMessage - userData:', JSON.stringify(userData));
      // Always use the first introduction prompt as the very first message
      if (userData.conversation_history.length === 1) {
        response = this.lonelinessScript[0].prompt;
        userData.script_progress = 0;
        userData.current_stage = 'loneliness_script';
        console.log('[DEBUG] First message, using intro prompt:', response);
      } else if (userData.user_preferred_name === null && userData.script_progress === 0) {
        response = "Before we continue, how would you like me to address you? (You can share a name or nickname, or just say 'no preference'.)";
        userData.script_progress = 1;
        userData.current_stage = 'loneliness_script';
        console.log('[DEBUG] Asking for preferred name');
      } else if (userData.user_preferred_name === null && userData.script_progress === 1) {
        if (!['no preference', 'no', 'none', ''].includes(userMessage.trim().toLowerCase())) {
          userData.user_preferred_name = userMessage.trim();
        }
        response = this.lonelinessScript[1].prompt;
        userData.script_progress = 2;
        userData.current_stage = 'loneliness_script';
        console.log('[DEBUG] Got preferred name, moving to next script prompt');
      } else {
        const currentStage = userData.current_stage || 'screening';
        console.log('[DEBUG] Current stage:', currentStage);
        if (currentStage === 'loneliness_script') {
          const nextItemId = this._determineNextScriptItem(userData, userMessage);
          console.log('[DEBUG] Next script item:', nextItemId);
          if (nextItemId.startsWith('intervention_')) {
            const interventionType = nextItemId.replace('intervention_', '');
            response = this._getInterventionResponse(interventionType);
            userData.current_stage = 'intervention';
            userData.intervention_type = interventionType;
            userData.intervention_stage_index = 0;
            console.log('[DEBUG] Branching to intervention:', interventionType);
          } else if (nextItemId.startsWith('script_')) {
            const scriptProgress = parseInt(nextItemId.replace('script_', ''));
            const currentItem = this.lonelinessScript[scriptProgress];
            response = currentItem.prompt || 'How are you feeling?';
            userData.script_progress = scriptProgress;
            userData.current_stage = 'loneliness_script';
            actionItems = this._checkForActionItems(userData, currentItem);
            console.log('[DEBUG] Continuing script, progress:', scriptProgress);
          } else {
            response = "Thank you for sharing that with me. How are you feeling right now?";
            console.log('[DEBUG] Fallback script response');
          }
        } else if (currentStage === 'intervention') {
          const nextStage = this._getNextInterventionStage(userData, userMessage);
          console.log('[DEBUG] Next intervention stage:', nextStage);
          if (nextStage) {
            response = nextStage.prompt;
            userData.intervention_stage_index = (userData.intervention_stage_index || 0) + 1;
            const interventionType = userData.intervention_type;
            const intervention = this.interventions[interventionType];
            if (intervention && intervention.intervention_stages && userData.intervention_stage_index >= intervention.intervention_stages.length) {
              response = "Thank you for working through this with me. I will check with you on the follow-ups till we connect again. When do you want to connect again?";
              userData.current_stage = 'intervention_complete';
              userData.intervention_type = null;
              userData.intervention_stage_index = 0;
              console.log('[DEBUG] Intervention complete');
            }
          } else {
            response = "Thank you for working through this with me. I will check with you on the follow-ups till we connect again. When do you want to connect again?";
            userData.current_stage = 'intervention_complete';
            userData.intervention_type = null;
            userData.intervention_stage_index = 0;
            console.log('[DEBUG] Intervention complete (no next stage)');
          }
        } else if (currentStage === 'intervention_complete') {
          response = "Perfect! I'll be here when you're ready to connect again. Take care and remember, you're not alone in this journey.";
          userData.current_stage = 'general';
          console.log('[DEBUG] Intervention follow-up complete');
        } else {
          // Fallback to question flow
          const nextQuestionId = this.determineNextQuestion(userData, userMessage);
          console.log('[DEBUG] Next question id:', nextQuestionId);
          if (nextQuestionId.startsWith('intervention_')) {
            const interventionType = nextQuestionId.replace('intervention_', '');
            response = this._getInterventionResponse(interventionType);
            userData.current_stage = 'intervention';
            userData.intervention_type = interventionType;
            console.log('[DEBUG] Branching to intervention from question:', interventionType);
          } else {
            const nextQuestion = this.findQuestionById(nextQuestionId);
            if (nextQuestion) {
              response = nextQuestion.question;
              userData.current_question = nextQuestionId;
              userData.current_stage = nextQuestion.branch || 'general';
              if (nextQuestion.branch) userData.branch = nextQuestion.branch;
              console.log('[DEBUG] Continuing question flow:', nextQuestionId);
            } else {
              response = "Thank you for sharing that with me. How are you feeling right now?";
              console.log('[DEBUG] Fallback question response');
            }
          }
        }
        if (actionItems && actionItems.length > 0) {
          this._updateActionItems(userData, actionItems);
          console.log('[DEBUG] Updated action items:', actionItems);
        }
        // Add user's preferred name occasionally
        if (userData.user_preferred_name && userData.script_progress && userData.script_progress % 3 === 0) {
          response = `${userData.user_preferred_name}, ${response}`;
          console.log('[DEBUG] Added preferred name to response');
        }
      }
      // AI enhancement (skip for interventions)
      let enhancedResponse = response;
      if (!['intervention', 'intervention_complete'].includes(userData.current_stage)) {
        const systemPrompt = this.buildSystemPrompt(userData);
        console.log('[DEBUG] System prompt for OpenAI:', systemPrompt);
        const aiResponse = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `User said: ${userMessage}\n\nCoach should respond with: ${response}\n\nStrictly use the provided script prompt as the main message. Do not add 'dear', 'my dear', or similar terms. Only build gently on the script prompt if needed. Only branch to intervention if keywords are detected.` }
          ],
          max_tokens: 300,
          temperature: 0.7
        });
        enhancedResponse = aiResponse.choices[0].message.content;
        console.log('[DEBUG] AI-enhanced response:', enhancedResponse);
      }
      userData.last_coach_message = enhancedResponse;
      userData.last_updated = new Date().toISOString();
      console.log('[DEBUG] Final response:', enhancedResponse);
      return {
        response: enhancedResponse,
        next_question_id: userData.current_question || '',
        current_stage: userData.current_stage,
        branch: userData.branch,
        intervention_type: userData.intervention_type,
        script_progress: userData.script_progress,
        action_items: actionItems,
        user_data: userData
      };
    } catch (error) {
      console.error('Error in AI agent:', error);
      return {
        response: "I'm here with you. Can you tell me a bit more about what you're experiencing?",
        next_question_id: userData.current_question || 'q1',
        current_stage: userData.current_stage || 'screening',
        branch: userData.branch,
        intervention_type: null,
        script_progress: userData.script_progress || 0,
        action_items: [],
        user_data: userData
      };
    }
  }
}

// Initialize AI Agent
let aiAgent = null;
if (openaiApiKey) {
  try {
    aiAgent = new NIYAsaathiAgent(openaiApiKey);
    console.log('✅ AI Agent initialized successfully');
      } catch (error) {
    console.error('AI Agent initialization error:', error);
    aiAgent = null;
  }
} else {
  console.log('Warning: OPENAI_API_KEY not found. AI features will be limited.');
}

// Export the NIYAsaathiAgent class
module.exports = NIYAsaathiAgent;

// ===== NEW FIREBASE FUNCTIONS (replacing Flask backend) =====

// Send verification code
exports.sendVerificationCode = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      const { phone_number } = req.body;
      
      if (!phone_number) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }
      
      // Generate verification code
      const code = generateVerificationCode();
      
      // Store code in Firestore
      await db.collection('verification_codes').doc(phone_number).set({
        code: code,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });
      
      // Send SMS via Twilio
      const message = `Your NIYAsaathi verification code is: ${code}. This code expires in 10 minutes.`;
      const smsSent = await sendSmsViaTwilio(phone_number, message);
      
      if (!smsSent) {
        // Fallback: log to console for development
        console.log(`Verification code for ${phone_number}: ${code}`);
        console.log('Note: SMS not sent. Check Twilio configuration.');
      }
      
      res.json({ message: 'Verification code sent successfully' });
      
    } catch (error) {
      console.error('Error sending verification code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Verify code
exports.verifyCode = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      const { phone_number, code } = req.body;
      
      if (!phone_number || !code) {
        res.status(400).json({ error: 'Phone number and code are required' });
        return;
      }
      
      // Get stored verification code
      const doc = await db.collection('verification_codes').doc(phone_number).get();
      
      if (!doc.exists) {
        res.status(400).json({ error: 'No verification code found for this phone number' });
        return;
      }
      
      const storedData = doc.data();
      
      // Check if code is expired
      if (new Date() > storedData.expires_at.toDate()) {
        res.status(400).json({ error: 'Verification code has expired' });
        return;
      }
      
      // Check if code matches
      if (storedData.code !== code) {
        res.status(400).json({ error: 'Invalid verification code' });
        return;
      }
      
      // Create or get user
      const userId = phone_number; // Use phone number as user ID
      let userData = await getUserData(userId);
      
      if (!userData.phone_number) {
        // New user
        userData.phone_number = phone_number;
        userData.created_at = new Date().toISOString();
      }
      
      // Update last login
      userData.last_login = new Date().toISOString();
      await saveUserData(userId, userData);
      
      // Generate token
      const token = generateToken(userId);
      
      // Clean up verification code
      await db.collection('verification_codes').doc(phone_number).delete();
      
      res.json({
        token: token,
        user: userData,
        message: 'Verification successful'
      });
    
  } catch (error) {
      console.error('Error verifying code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Handle chat message
exports.handleMessage = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const { message } = req.body;
      const userId = payload.user_id;
      
      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }
      
      // Get user data
      let userData = await getUserData(userId);
      
      // Process message with AI agent
      let response;
      if (aiAgent) {
        const result = await aiAgent.processMessage(userData, message);
        response = result.response;
        userData = result.user_data;
      } else {
        response = "I'm sorry, but I'm not able to process messages right now. Please try again later.";
      }
      
      // Save updated user data
      await saveUserData(userId, userData);
      
      res.json({
        response: response,
        user_data: userData
      });
    
  } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Get user data
exports.getUserData = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
    const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
      return;
    }
    
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const userId = payload.user_id;
      const userData = await getUserData(userId);
      
      res.json({ user_data: userData });
    
  } catch (error) {
      console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
  });
});

// Health check
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ai_agent_available: !!aiAgent,
        twilio_available: !!twilioClient,
        openai_configured: !!openaiApiKey
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  });
});

// ===== EXISTING FUNCTIONS (kept for compatibility) =====

// Simple test function
exports.helloWorld = functions.https.onRequest((req, res) => {
  res.json({ 
    message: 'Hello from NIYAsaathi!',
    openaiConfigured: !!openaiApiKey,
    twilioConfigured: !!twilioClient
  });
});

// Function to register a new nudge
exports.registerNudge = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    const { user_id, phone_number, message, intervention_type, send_at } = req.body;
    
    if (!user_id || !phone_number || !message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    const nudgeData = {
      user_id,
      phone_number,
      message,
      intervention_type: intervention_type || 'general_loneliness',
      send_at: send_at ? new Date(send_at) : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to 24 hours from now
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      sent: false,
      retry_count: 0
    };
    
    const docRef = await db.collection('nudges').add(nudgeData);
    
    res.json({
      success: true,
      nudge_id: docRef.id,
      message: 'Nudge registered successfully'
    });
    
  } catch (error) {
    console.error('Error registering nudge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to get nudge statistics
exports.getNudgeStats = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    // Get total nudges
    const totalSnapshot = await db.collection('nudges').get();
    const totalNudges = totalSnapshot.size;
    
    // Get sent nudges
    const sentSnapshot = await db.collection('nudges').where('sent', '==', true).get();
    const sentNudges = sentSnapshot.size;
    
    // Get failed nudges
    const failedSnapshot = await db.collection('nudges').where('sent', '==', false).get();
    const failedNudges = failedSnapshot.size;
    
    res.json({
      success: true,
      stats: {
        total: totalNudges,
        sent: sentNudges,
        failed: failedNudges,
        success_rate: totalNudges > 0 ? (sentNudges / totalNudges * 100).toFixed(2) : 0
      }
    });
    
  } catch (error) {
    console.error('Error getting nudge stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to test OpenAI integration
exports.testOpenAI = functions.https.onRequest(async (req, res) => {
  try {
    if (!openaiApiKey) {
      res.status(400).json({ error: 'OpenAI API key not configured' });
      return;
    }
    
    res.json({
      success: true,
      message: 'OpenAI API key is configured',
      hasKey: !!openaiApiKey
    });
    
  } catch (error) {
    console.error('Error testing OpenAI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== NEW ACTION ITEM & REMINDER FUNCTIONS =====

// Get action item reminders for a user
exports.getActionItemReminders = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const userId = payload.user_id;
      const userData = await getUserData(userId);
      
      if (!aiAgent) {
        res.status(500).json({ error: 'AI Agent not available' });
        return;
      }
      
      const reminders = aiAgent.getActionItemReminders(userData);
      
      res.json({
        success: true,
        reminders: reminders
      });
      
    } catch (error) {
      console.error('Error getting action item reminders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Mark action item as completed
exports.markActionItemCompleted = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const { action_item_id } = req.body;
      const userId = payload.user_id;
      
      if (!action_item_id) {
        res.status(400).json({ error: 'Action item ID is required' });
        return;
      }
      
      let userData = await getUserData(userId);
      
      if (!aiAgent) {
        res.status(500).json({ error: 'AI Agent not available' });
        return;
      }
      
      aiAgent.markActionItemCompleted(userData, action_item_id);
      await saveUserData(userId, userData);
      
      res.json({
        success: true,
        message: 'Action item marked as completed',
        user_data: userData
      });
      
    } catch (error) {
      console.error('Error marking action item completed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Get follow-up message for a user
exports.getFollowUpMessage = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const userId = payload.user_id;
      const userData = await getUserData(userId);
      
      if (!aiAgent) {
        res.status(500).json({ error: 'AI Agent not available' });
        return;
      }
      
      const followUpMessage = aiAgent.getFollowUpMessage(userData);
      
      res.json({
        success: true,
        follow_up_message: followUpMessage
      });
      
    } catch (error) {
      console.error('Error getting follow-up message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Get daily journal prompt
exports.getDailyJournalPrompt = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const { day_number } = req.query;
      const userId = payload.user_id;
      
      if (!day_number) {
        res.status(400).json({ error: 'Day number is required' });
        return;
      }
      
      const userData = await getUserData(userId);
      
      if (!aiAgent) {
        res.status(500).json({ error: 'AI Agent not available' });
        return;
      }
      
      const journalPrompt = aiAgent.getDailyJournalPrompt(userData, parseInt(day_number));
      
      res.json({
        success: true,
        journal_prompt: journalPrompt
      });
      
    } catch (error) {
      console.error('Error getting daily journal prompt:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Send follow-up check-in
exports.sendFollowUpCheckin = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const { action_item_id } = req.body;
      const userId = payload.user_id;
      
      if (!action_item_id) {
        res.status(400).json({ error: 'Action item ID is required' });
        return;
      }
      
      const userData = await getUserData(userId);
      
      if (!aiAgent) {
        res.status(500).json({ error: 'AI Agent not available' });
        return;
      }
      
      const checkinMessage = aiAgent.sendFollowUpCheckin(userData, action_item_id);
      
      res.json({
        success: true,
        checkin_message: checkinMessage
      });
      
    } catch (error) {
      console.error('Error sending follow-up check-in:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Start loneliness script for a user
exports.startLonelinessScript = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token is missing' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = verifyToken(token);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      
      const userId = payload.user_id;
      let userData = await getUserData(userId);
      
      if (!aiAgent) {
        res.status(500).json({ error: 'AI Agent not available' });
        return;
      }
      
      const result = aiAgent.startLonelinessScript(userData);
      await saveUserData(userId, result.user_data);
      
      res.json({
        success: true,
        response: result.response,
        user_data: result.user_data,
        action_items: result.action_items
      });
      
    } catch (error) {
      console.error('Error starting loneliness script:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Scheduled function to send action item reminders
exports.sendActionItemReminders = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    console.log('Checking for action item reminders...');
    
    // Get all users with action items
    const usersSnapshot = await db.collection('users').get();
    const reminderPromises = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      if (!aiAgent || !userData.action_items || userData.action_items.length === 0) {
        continue;
      }
      
      const reminders = aiAgent.getActionItemReminders(userData);
      
      for (const reminder of reminders) {
        // Send SMS reminder if Twilio is configured
        if (twilioClient && userData.phone_number) {
          try {
            await twilioClient.messages.create({
              body: reminder.message,
              from: twilioPhoneNumber,
              to: userData.phone_number
            });
            
            // Mark reminder as sent
            reminder.action_item.reminder_sent = true;
            reminder.action_item.reminder_sent_at = new Date().toISOString();
            
            console.log(`Reminder sent to ${userData.phone_number} for action item ${reminder.id}`);
          } catch (error) {
            console.error(`Failed to send reminder to ${userData.phone_number}:`, error);
          }
        }
      }
      
      // Update user data with reminder status
      if (reminders.length > 0) {
        await saveUserData(userDoc.id, userData);
      }
    }
    
    console.log('Action item reminder process completed');
    
  } catch (error) {
    console.error('Error in sendActionItemReminders:', error);
    throw error;
  }
});

// Export the NIYAsaathiAgent class
module.exports = NIYAsaathiAgent;

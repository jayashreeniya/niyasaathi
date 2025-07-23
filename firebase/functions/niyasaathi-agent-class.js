// NIYAsaathiAgent class for Firebase Functions
const questions = require('./data/questions.json');
const interventions = require('./data/interventions.json');
const lonelinessScript = require('./data/loneliness_script.json');

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
    // This method determines the next question based on user response
    // Implementation would go here
    return 'next_question_id';
  }
  
  _determineNextScriptItem(userData, userMessage) {
    const currentScriptProgress = userData.script_progress || 0;
    const currentItem = this.lonelinessScript[currentScriptProgress];
    
    if (!currentItem) {
      return 'intervention_general_loneliness';
    }
    
    // Check if we're at the explore_causes_intro step and need to branch
    if (currentItem.id === 'explore_causes_intro') {
      const userResponseLower = userMessage.toLowerCase();
      
      // Changes in relationships
      const relationshipKeywords = ['changes in relationships', 'breakup', 'divorce', 'friendship drift', '1', 'one', 'first'];
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
  
  async processMessage(userData, userMessage) {
    try {
      // Ensure conversation history exists
      if (!userData.conversation_history) {
        userData.conversation_history = [];
      }

      // Add current exchange to history
      userData.conversation_history.push({
        timestamp: new Date().toISOString(),
        coach_message: userData.last_coach_message || '',
        user_message: userMessage
      });

      // Track user preferred name
      if (!('user_preferred_name' in userData)) {
        userData.user_preferred_name = null;
      }

      let response = '';
      let actionItems = [];

      // Always use the first introduction prompt as the very first message
      if (userData.conversation_history.length === 1) {
        response = this.lonelinessScript[0].prompt;
        userData.script_progress = 0;
        userData.current_stage = 'loneliness_script';
      }
      // Ask for preferred name after the first prompt
      else if (userData.user_preferred_name === null && userData.script_progress === 0) {
        response = "Before we continue, how would you like me to address you? (You can share a name or nickname, or just say 'no preference'.)";
        userData.script_progress = 1;
        userData.current_stage = 'loneliness_script';
      }
      else if (userData.user_preferred_name === null && userData.script_progress === 1) {
        // Save the preferred name if provided
        if (!['no preference', 'no', 'none', ''].includes(userMessage.trim().toLowerCase())) {
          userData.user_preferred_name = userMessage.trim();
        }
        response = this.lonelinessScript[1].prompt;
        userData.script_progress = 2;
        userData.current_stage = 'loneliness_script';
      }
      else {
        const currentStage = userData.current_stage || 'screening';
        
        if (currentStage === 'loneliness_script') {
          const nextItemId = this._determineNextScriptItem(userData, userMessage);
          
          if (nextItemId.startsWith('intervention_')) {
            const interventionType = nextItemId.replace('intervention_', '');
            response = this._getInterventionResponse(interventionType);
            userData.current_stage = 'intervention';
            userData.intervention_type = interventionType;
            userData.intervention_stage_index = 0;
          }
          else if (nextItemId.startsWith('script_')) {
            const scriptProgress = parseInt(nextItemId.replace('script_', ''));
            const currentItem = this.lonelinessScript[scriptProgress];
            // Strictly use the JSON prompt, only build gently if needed
            response = currentItem ? currentItem.prompt : 'How are you feeling?';
            userData.script_progress = scriptProgress;
            userData.current_stage = 'loneliness_script';
            actionItems = this._checkForActionItems(userData, currentItem);
          }
          else {
            response = "Thank you for sharing that with me. How are you feeling right now?";
          }
        }
        else if (currentStage === 'intervention') {
          // Handle multi-stage intervention flow
          const nextStage = this._getNextInterventionStage(userData, userMessage);
          
          if (nextStage) {
            response = nextStage.prompt;
            userData.intervention_stage_index = (userData.intervention_stage_index || 0) + 1;
            
            // Check if this is the last stage
            const interventionType = userData.intervention_type;
            if (interventionType && this.interventions[interventionType]) {
              const intervention = this.interventions[interventionType];
              if (intervention.intervention_stages) {
                const stages = intervention.intervention_stages;
                if (userData.intervention_stage_index >= stages.length) {
                  // End of intervention, provide closing message
                  response = "Thank you for working through this with me. I will check with you on the follow-ups till we connect again. When do you want to connect again?";
                  userData.current_stage = 'intervention_complete';
                  userData.intervention_type = null;
                  userData.intervention_stage_index = 0;
                }
              }
            }
          }
          else {
            // End of intervention or error, provide closing message
            response = "Thank you for working through this with me. I will check with you on the follow-ups till we connect again. When do you want to connect again?";
            userData.current_stage = 'intervention_complete';
            userData.intervention_type = null;
            userData.intervention_stage_index = 0;
          }
        }
        else if (currentStage === 'intervention_complete') {
          // Handle response after intervention completion
          response = "Perfect! I'll be here when you're ready to connect again. Take care and remember, you're not alone in this journey.";
          userData.current_stage = 'general';
        }
        else {
          const nextQuestionId = this._determineNextQuestion(userData, userMessage);
          
          if (nextQuestionId.startsWith('intervention_')) {
            const interventionType = nextQuestionId.replace('intervention_', '');
            response = this._getInterventionResponse(interventionType);
            userData.current_stage = 'intervention';
            userData.intervention_type = interventionType;
          }
          else {
            const nextQuestion = this.findQuestionById(nextQuestionId);
            if (nextQuestion) {
              response = nextQuestion.question;
              userData.current_question = nextQuestionId;
              userData.current_stage = nextQuestion.branch || 'general';
              if (nextQuestion.branch) {
                userData.branch = nextQuestion.branch;
              }
            }
            else {
              response = "Thank you for sharing that with me. How are you feeling right now?";
            }
          }
        }
        
        if (actionItems && actionItems.length > 0) {
          this._updateActionItems(userData, actionItems);
        }
        
        // Add user's preferred name occasionally (every 3rd message after set)
        if (userData.user_preferred_name && userData.script_progress && userData.script_progress % 3 === 0) {
          response = `${userData.user_preferred_name}, ${response}`;
        }
      }

      // AI enhancement (skip for interventions)
      let enhancedResponse = response;
      if (!['intervention', 'intervention_complete'].includes(userData.current_stage)) {
        const systemPrompt = this.buildSystemPrompt(userData);
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
      }

      userData.last_coach_message = enhancedResponse;
      userData.last_updated = new Date().toISOString();

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

module.exports = NIYAsaathiAgent; 
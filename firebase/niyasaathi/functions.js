// Firebase Functions for NIYAsaathi Backend
// This file replicates the Flask backend functionality in Node.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Load environment variables
const openaiApiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
const twilioAccountSid = functions.config().twilio?.account_sid || process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = functions.config().twilio?.auth_token || process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = functions.config().twilio?.phone_number || process.env.TWILIO_PHONE_NUMBER;

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
  
  async processMessage(userData, userMessage) {
    try {
      const systemPrompt = this.buildSystemPrompt(userData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7
      });
      
      const aiResponse = response.choices[0].message.content;
      
      // Update user data based on AI response
      const nextQuestion = this.determineNextQuestion(userData, userMessage);
      userData.current_question = nextQuestion;
      userData.last_coach_message = aiResponse;
      userData.last_updated = new Date().toISOString();
      
      // Add to conversation history
      if (!userData.conversation_history) {
        userData.conversation_history = [];
      }
      userData.conversation_history.push({
        user_message: userMessage,
        coach_message: aiResponse,
        timestamp: new Date().toISOString()
      });
      
      return {
        response: aiResponse,
        next_question: nextQuestion,
        user_data: userData
      };
    } catch (error) {
      console.error('Error processing message with AI:', error);
      return {
        response: "I'm having trouble processing your message right now. Please try again in a moment.",
        next_question: userData.current_question,
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

// Firebase Functions

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

// Test OpenAI integration
exports.testOpenAI = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
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
}); 
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const os = require('os');
const fs = require('fs');
const textToSpeech = require('@google-cloud/text-to-speech');
const NudgeSystem = require('./nudgeSystem');
const NIYAsaathiAgent = require('./niyasaathi-agent-class');

admin.initializeApp();
const db = admin.firestore();

// Initialize Nudge System
const nudgeSystem = new NudgeSystem();

// Initialize AI Agent
const openaiApiKey = process.env.OPENAI_API_KEY || functions.config().openai?.api_key;
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

// Twilio configuration helper function
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || functions.config().twilio?.account_sid;
  const authToken = process.env.TWILIO_AUTH_TOKEN || functions.config().twilio?.auth_token;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || functions.config().twilio?.phone_number || '+14155238886';
  
  // Validate credentials before creating client
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    console.warn('Invalid or missing Twilio credentials');
    return null;
  }
  
  try {
    return {
      client: new twilio(accountSid, authToken),
      phoneNumber: twilioPhoneNumber
    };
  } catch (error) {
    console.error('Error creating Twilio client:', error);
    return null;
  }
}

// Send scheduled nudges every hour
exports.sendScheduledNudges = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
  const now = new Date();
    console.log(`Checking for nudges to send at ${now.toISOString()}`);
    
    // Get Twilio client
    const twilioConfig = getTwilioClient();
    if (!twilioConfig) {
      console.warn('Twilio not configured, skipping nudge sending');
      return;
    }
    
    const snapshot = await db.collection('nudges')
      .where('send_at', '<=', now)
      .where('sent', '==', false)
      .get();
    
    console.log(`Found ${snapshot.size} nudges to send`);
    
    const sendPromises = snapshot.docs.map(async (doc) => {
      const nudgeData = doc.data();
      
      try {
        // Send SMS via Twilio
        await twilioConfig.client.messages.create({
          body: nudgeData.message,
          from: twilioConfig.phoneNumber,
          to: nudgeData.phone_number
        });
        
        // Mark as sent
        await doc.ref.update({
          sent: true,
          sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Nudge sent successfully to ${nudgeData.phone_number}`);
        
        // Log the interaction
        await db.collection('nudge_logs').add({
          user_id: nudgeData.user_id,
          phone_number: nudgeData.phone_number,
          message: nudgeData.message,
          intervention_type: nudgeData.intervention_type,
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
          status: 'delivered'
        });
        
      } catch (error) {
        console.error(`Error sending nudge to ${nudgeData.phone_number}:`, error);
        
        // Mark as failed
        await doc.ref.update({
          sent: false,
          error: error.message,
          retry_count: (nudgeData.retry_count || 0) + 1
        });
        
        // Log the error
        await db.collection('nudge_logs').add({
          user_id: nudgeData.user_id,
          phone_number: nudgeData.phone_number,
          message: nudgeData.message,
          intervention_type: nudgeData.intervention_type,
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
          status: 'failed',
          error: error.message
        });
      }
    });
    
    await Promise.all(sendPromises);
    console.log('Nudge sending process completed');
    
  } catch (error) {
    console.error('Error in sendScheduledNudges:', error);
    throw error;
  }
});

// Clean up old nudges (older than 30 days)
exports.cleanupOldNudges = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const snapshot = await db.collection('nudges')
      .where('created_at', '<', thirtyDaysAgo)
      .get();
    
    console.log(`Found ${snapshot.size} old nudges to clean up`);
    
    const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    
    console.log('Old nudges cleanup completed');
    
  } catch (error) {
    console.error('Error in cleanupOldNudges:', error);
    throw error;
  }
});

// HTTP endpoint to manually trigger nudge sending (for testing)
exports.triggerNudges = functions.https.onRequest(async (req, res) => {
  try {
    // Verify the request is authorized (you can add your own auth logic here)
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // Trigger the nudge sending function
    await exports.sendScheduledNudges();
    
    res.json({ success: true, message: 'Nudges triggered successfully' });
    
  } catch (error) {
    console.error('Error triggering nudges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    
    // Get nudges by intervention type
    const interventionStats = {};
    totalSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const type = data.intervention_type || 'unknown';
      interventionStats[type] = (interventionStats[type] || 0) + 1;
    });
    
    res.json({
      success: true,
      stats: {
        total: totalNudges,
        sent: sentNudges,
        failed: failedNudges,
        success_rate: totalNudges > 0 ? (sentNudges / totalNudges * 100).toFixed(2) : 0,
        by_intervention_type: interventionStats
      }
    });
    
  } catch (error) {
    console.error('Error getting nudge stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Azure TTS /speak endpoint
//checking it it picks it up
exports.speak = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const text = req.body.text;
  if (!text) {
    res.status(400).json({ error: 'No text provided' });
    return;
  }

  // Check text length - Azure TTS has a limit of ~10,000 characters
  if (text.length > 10000) {
    res.status(400).json({ error: 'Text too long. Maximum 10,000 characters allowed.' });
    return;
  }

  console.log('Azure TTS request - Text length:', text.length);
  console.log('Azure TTS request - Text preview:', text.substring(0, 100) + '...');

  // Get Azure credentials from env or config
  const speechKey = process.env.AZURE_SPEECH_KEY || functions.config().azure?.speech_key;
  const serviceRegion = process.env.AZURE_SPEECH_REGION || functions.config().azure?.speech_region;
  if (!speechKey || !serviceRegion) {
    res.status(503).json({ error: 'Azure Speech credentials not configured' });
    return;
  }

  // Generate a temp file path
  const tmpMp3 = os.tmpdir() + `/tts_${Date.now()}.mp3`;

  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, serviceRegion);
    speechConfig.speechSynthesisVoiceName = 'en-IN-AartiNeural';
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    console.log('Using Azure TTS voice:', speechConfig.speechSynthesisVoiceName);
    console.log('Azure region:', serviceRegion);
    console.log('Output format: MP3');
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(tmpMp3);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        result => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve();
          } else {
            reject(new Error('Speech synthesis failed: ' + result.errorDetails));
          }
        },
        error => {
          reject(error);
        }
      );
    });

    // Read the file and send as response
    const audioBuffer = fs.readFileSync(tmpMp3);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', 'inline; filename="response.mp3"');
    res.send(audioBuffer);
    // Clean up temp file
    fs.unlink(tmpMp3, () => {});
  } catch (err) {
    console.error('Azure TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
    if (fs.existsSync(tmpMp3)) fs.unlink(tmpMp3, () => {});
  }
});

// Get pending nudges for a user
exports.getPendingNudges = functions.https.onRequest(async (req, res) => {
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

    const { user_id } = req.body;
    if (!user_id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const pendingNudges = nudgeSystem.checkPendingNudges(userData);

    res.json({
      success: true,
      pending_nudges: pendingNudges
    });

  } catch (error) {
    console.error('Error getting pending nudges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete an action item
exports.completeActionItem = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { user_id, action_item_id } = req.body;
    if (!user_id || !action_item_id) {
      res.status(400).json({ error: 'User ID and action item ID are required' });
      return;
    }

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const success = nudgeSystem.markActionItemCompleted(userData, action_item_id);

    if (success) {
      // Save updated user data
      await db.collection('users').doc(user_id).set(userData);
      
      // Get updated progress summary
      const progressSummary = nudgeSystem.getUserProgressSummary(userData);

      res.json({
        success: true,
        message: 'Action item completed successfully',
        progress_summary: progressSummary
      });
    } else {
      res.status(404).json({ error: 'Action item not found' });
    }

  } catch (error) {
    console.error('Error completing action item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user progress summary
exports.getUserProgress = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { user_id } = req.body;
    if (!user_id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const progressSummary = nudgeSystem.getUserProgressSummary(userData);

    res.json({
      success: true,
      progress_summary: progressSummary,
      action_items: userData.action_items || []
    });

  } catch (error) {
    console.error('Error getting user progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new action item
exports.createActionItem = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { user_id, item_type, description, due_hours } = req.body;
    if (!user_id || !description) {
      res.status(400).json({ error: 'User ID and description are required' });
      return;
    }

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const itemId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const actionItem = nudgeSystem.createActionItem(
      itemId,
      item_type || 'exercise',
      description,
      due_hours || 24
    );

    nudgeSystem.addActionItem(userData, actionItem);

    // Save updated user data
    await db.collection('users').doc(user_id).set(userData);

    res.json({
      success: true,
      action_item: actionItem,
      message: 'Action item created successfully'
    });

  } catch (error) {
    console.error('Error creating action item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily reflection reminder
exports.getDailyReflection = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { user_id, day_number } = req.body;
    if (!user_id || !day_number) {
      res.status(400).json({ error: 'User ID and day number are required' });
      return;
    }

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const reflection = nudgeSystem.getDailyReflectionReminder(userData, day_number);

    if (reflection) {
      res.json({
        success: true,
        reflection: reflection
      });
    } else {
      res.status(404).json({ error: 'Daily reflection not found for this day number' });
    }

  } catch (error) {
    console.error('Error getting daily reflection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google Cloud TTS /speak endpoint
exports.speak = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const text = req.body.text;
  if (!text) {
    res.status(400).json({ error: 'No text provided' });
    return;
  }

  // Check text length - Google TTS has a limit of ~5,000 characters
  if (text.length > 5000) {
    res.status(400).json({ error: 'Text too long. Maximum 5,000 characters allowed.' });
    return;
  }

  console.log('Google TTS request - Text length:', text.length);
  console.log('Google TTS request - Text preview:', text.substring(0, 100) + '...');

  try {
    // Initialize Google Cloud TTS client only when needed
    const client = new textToSpeech.TextToSpeechClient();

    // Remove all SSML and chunk at sentence boundaries for smooth audio
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > 4500) { // stay under 5000 char limit
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // If text is short enough, process as single chunk
    if (chunks.length === 0) {
      chunks.push(text);
    }

    console.log('Processing', chunks.length, 'text chunks');

    // Synthesize each chunk and concatenate audio buffers
    let audioBuffers = [];
    for (const chunk of chunks) {
      const request = {
        input: { text: chunk },
        voice: {
          languageCode: 'en-IN',
          name: 'en-IN-Chirp3-HD-Gacrux'
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          speakingRate: 0.81
        }
      };

      console.log('Processing chunk:', chunk.substring(0, 50) + '...');

      const [response] = await client.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('No audio content received from Google TTS');
      }

      audioBuffers.push(Buffer.from(response.audioContent, 'base64'));
    }

    // Concatenate all audio buffers
    const finalAudio = Buffer.concat(audioBuffers);
    console.log('Final audio size:', finalAudio.length, 'bytes');

    // Send the concatenated audio as response
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Disposition', 'inline; filename="response.wav"');
    res.send(finalAudio);

  } catch (err) {
    console.error('Google TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed: ' + err.message });
  }
});

// Utility functions for authentication and user management
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
  return jwt.verify(token, secret);
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getUserData(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data();
    } else {
      // Create new user data
      const newUserData = {
        user_id: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
        conversation_history: [],
        script_progress: 0,
        current_stage: 'screening',
        user_preferred_name: null
      };
      await saveUserData(userId, newUserData);
      return newUserData;
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

async function saveUserData(userId, userData) {
  try {
    userData.last_updated = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(userId).set(userData, { merge: true });
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

// Handle chat message
exports.handleMessage = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
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

// Get user data
exports.getUserData = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
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

// Send verification code
exports.sendVerificationCode = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
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

    // For development, log the code instead of sending SMS
    console.log(`Verification code for ${phone_number}: ${code}`);

    res.json({ message: 'Verification code sent successfully' });

  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify code
exports.verifyCode = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { phone_number, code } = req.body;

    if (!phone_number || !code) {
      res.status(400).json({ error: 'Phone number and code are required' });
      return;
    }

    // Get stored verification code
    const codeDoc = await db.collection('verification_codes').doc(phone_number).get();

    if (!codeDoc.exists) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    const storedData = codeDoc.data();
    const now = new Date();

    if (now > storedData.expires_at.toDate()) {
      res.status(400).json({ error: 'Verification code has expired' });
      return;
    }

    if (storedData.code !== code) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    // Generate user ID and token
    const userId = `user_${phone_number.replace(/\D/g, '')}`;
    const token = generateToken(userId);

    // Create or update user
    const user = {
      id: userId,
      phone_number: phone_number,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      last_login: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userId).set(user, { merge: true });

    // Delete the verification code
    await db.collection('verification_codes').doc(phone_number).delete();

    res.json({
      success: true,
      token: token,
      user: user
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ai_agent_available: !!aiAgent,
      openai_configured: !!openaiApiKey
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// OpenAI configuration
const openaiApiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;

// Twilio configuration (optional for now)
const accountSid = process.env.TWILIO_ACCOUNT_SID || functions.config().twilio?.account_sid || 'TWILIO_SID';
const authToken = process.env.TWILIO_AUTH_TOKEN || functions.config().twilio?.auth_token || 'TWILIO_AUTH';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || functions.config().twilio?.phone_number || '+14155238886';

// Only initialize Twilio client if we have valid credentials
let twilioClient = null;
if (accountSid && accountSid !== 'TWILIO_SID' && authToken && authToken !== 'TWILIO_AUTH') {
  try {
    const twilio = require('twilio');
    twilioClient = new twilio(accountSid, authToken);
  } catch (error) {
    console.warn('Failed to initialize Twilio client:', error.message);
  }
}

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

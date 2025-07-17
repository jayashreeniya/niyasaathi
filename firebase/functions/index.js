const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const os = require('os');
const fs = require('fs');
const textToSpeech = require('@google-cloud/text-to-speech');
const NudgeSystem = require('./nudgeSystem');

admin.initializeApp();
const db = admin.firestore();

// Initialize Nudge System
const nudgeSystem = new NudgeSystem();

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

  // Preprocess text to make it more empathetic
  let processedText = text
    // Add pauses after commas and periods for more natural speech
    .replace(/,/g, ', <break time="300ms"/>')
    .replace(/\./g, '. <break time="500ms"/>')
    // Add gentle pauses for questions
    .replace(/\?/g, '? <break time="400ms"/>');

  console.log('Google TTS request - Text length:', processedText.length);
  console.log('Google TTS request - Text preview:', processedText.substring(0, 100) + '...');

  try {
    // Initialize Google Cloud TTS client only when needed
    const client = new textToSpeech.TextToSpeechClient();

    // Configure the request with the Indian female voice
    const request = {
      input: { text: processedText },
      voice: {
        languageCode: 'en-IN',
        name: 'en-IN-Chirp3-HD-Despina'
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        effectsProfileId: ['small-bluetooth-speaker-class-device'],
        speakingRate: 0.81  // Back to original speed
      }
    };

    console.log('Using Google TTS voice:', request.voice.name);
    console.log('Audio config:', request.audioConfig);

    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    console.log('Google TTS response received, audio size:', response.audioContent.length, 'bytes');

    // Send the audio as response
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Disposition', 'inline; filename="response.wav"');
    res.send(Buffer.from(response.audioContent, 'base64'));

  } catch (err) {
    console.error('Google TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed: ' + err.message });
  }
});

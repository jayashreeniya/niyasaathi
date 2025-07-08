const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

admin.initializeApp();
const db = admin.firestore();

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'TWILIO_SID';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'TWILIO_AUTH';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+14155238886';

const client = new twilio(accountSid, authToken);

// Send scheduled nudges every hour
exports.sendScheduledNudges = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    const now = new Date();
    console.log(`Checking for nudges to send at ${now.toISOString()}`);
    
    const snapshot = await db.collection('nudges')
      .where('send_at', '<=', now)
      .where('sent', '==', false)
      .get();
    
    console.log(`Found ${snapshot.size} nudges to send`);
    
    const sendPromises = snapshot.docs.map(async (doc) => {
      const nudgeData = doc.data();
      
      try {
        // Send SMS via Twilio
        await client.messages.create({
          body: nudgeData.message,
          from: twilioPhoneNumber,
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

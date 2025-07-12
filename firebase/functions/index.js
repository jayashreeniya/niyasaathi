const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { NIYAsaathiAgent } = require('./ai_agent');

const app = express();

// Enable CORS
app.use(cors({ origin: true }));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Initialize AI Agent
let aiAgent = null;

// Initialize AI Agent with environment variables
function initializeAgent() {
    if (!aiAgent) {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        aiAgent = new NIYAsaathiAgent(openaiApiKey);
    }
    return aiAgent;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'NIYAsaathi Firebase Functions'
    });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const { message, user_data } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const agent = initializeAgent();
        const response = await agent.process_message(user_data || {}, message);
        
        res.json(response);
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Text-to-speech endpoint
app.post('/speak', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // For now, return a simple response
        // You can integrate Azure Speech Services here
        res.json({ 
            success: true, 
            message: 'Text-to-speech endpoint ready for Azure integration',
            text: text 
        });
    } catch (error) {
        console.error('Error in speak endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// User data endpoint
app.get('/user/data', (req, res) => {
    try {
        const userData = req.query.user_id ? 
            { user_id: req.query.user_id, last_updated: new Date().toISOString() } : 
            { message: 'No user data found' };
        
        res.json(userData);
    } catch (error) {
        console.error('Error in user data endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Authentication endpoints
app.post('/auth/send-code', async (req, res) => {
    try {
        const { phone_number } = req.body;
        
        if (!phone_number) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Generate a simple verification code (in production, use Twilio)
        const code = Math.floor(100000 + Math.random() * 900000);
        
        // Store the code temporarily (in production, use Firebase Auth)
        console.log(`Verification code for ${phone_number}: ${code}`);
        
        res.json({ 
            success: true, 
            message: 'Verification code sent',
            code: code // Remove this in production
        });
    } catch (error) {
        console.error('Error in send code endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

app.post('/auth/verify-code', async (req, res) => {
    try {
        const { phone_number, code } = req.body;
        
        if (!phone_number || !code) {
            return res.status(400).json({ error: 'Phone number and code are required' });
        }

        // Simple verification (in production, use Firebase Auth)
        // For demo purposes, accept any 6-digit code
        if (code.length === 6 && /^\d+$/.test(code)) {
            const user = {
                id: `user_${Date.now()}`,
                phone_number: phone_number,
                created_at: new Date().toISOString()
            };
            
            res.json({ 
                success: true, 
                message: 'Verification successful',
                user: user,
                token: `token_${Date.now()}` // In production, use JWT
            });
        } else {
            res.status(400).json({ error: 'Invalid verification code' });
        }
    } catch (error) {
        console.error('Error in verify code endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Export the Express app as a Firebase Cloud Function
exports.api = functions.https.onRequest(app);

// Export individual functions for better performance
exports.chat = functions.https.onCall(async (data, context) => {
    try {
        const { message, user_data } = data;
        
        if (!message) {
            throw new functions.https.HttpsError('invalid-argument', 'Message is required');
        }

        const agent = initializeAgent();
        const response = await agent.process_message(user_data || {}, message);
        
        return response;
    } catch (error) {
        console.error('Error in chat function:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.speak = functions.https.onCall(async (data, context) => {
    try {
        const { text } = data;
        
        if (!text) {
            throw new functions.https.HttpsError('invalid-argument', 'Text is required');
        }

        // Return simple response for now
        return { 
            success: true, 
            message: 'Text-to-speech endpoint ready for Azure integration',
            text: text 
        };
    } catch (error) {
        console.error('Error in speak function:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

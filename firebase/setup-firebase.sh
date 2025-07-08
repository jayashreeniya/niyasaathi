#!/bin/bash

# NIYAsaathi Firebase Setup Script
# This script helps you set up Firebase for the NIYAsaathi loneliness coach

echo "🚀 Setting up Firebase for NIYAsaathi..."
echo "========================================"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase first:"
    echo "   firebase login"
    exit 1
fi

# Create project if it doesn't exist
echo "📋 Creating Firebase project..."
firebase projects:create niyasaathi-loneliness-coach --display-name "NIYAsaathi Loneliness Coach"

# Initialize Firebase in current directory
echo "🔧 Initializing Firebase configuration..."
firebase init --project niyasaathi-loneliness-coach --yes

# Install dependencies
echo "📦 Installing dependencies..."
cd functions
npm install
cd ..

# Set up environment variables
echo "🔑 Setting up environment variables..."
echo "Please enter your configuration values:"

read -p "Twilio Account SID: " TWILIO_SID
read -p "Twilio Auth Token: " TWILIO_TOKEN
read -p "Twilio Phone Number (e.g., +14155238886): " TWILIO_PHONE
read -p "OpenAI API Key: " OPENAI_KEY
read -p "Admin Secret (generate a secure random string): " ADMIN_SECRET

# Set Firebase Functions config
firebase functions:config:set twilio.account_sid="$TWILIO_SID"
firebase functions:config:set twilio.auth_token="$TWILIO_TOKEN"
firebase functions:config:set twilio.phone_number="$TWILIO_PHONE"
firebase functions:config:set openai.api_key="$OPENAI_KEY"
firebase functions:config:set admin.secret="$ADMIN_SECRET"

# Create .env file
cat > functions/.env << EOF
# Twilio Configuration
TWILIO_ACCOUNT_SID=$TWILIO_SID
TWILIO_AUTH_TOKEN=$TWILIO_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE

# Admin Secret for API endpoints
ADMIN_SECRET=$ADMIN_SECRET

# OpenAI Configuration
OPENAI_API_KEY=$OPENAI_KEY

# Firebase Configuration
FIREBASE_PROJECT_ID=niyasaathi-loneliness-coach
EOF

echo "✅ Environment variables configured!"

# Deploy Firestore rules and indexes
echo "📋 Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Deploy Functions
echo "🚀 Deploying Firebase Functions..."
firebase deploy --only functions

echo ""
echo "🎉 Firebase setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update frontend/firebase-config.js with your Firebase project configuration"
echo "2. Test the application locally: firebase emulators:start"
echo "3. Deploy the frontend: firebase deploy --only hosting"
echo ""
echo "For detailed instructions, see firebase-setup.md" 
 
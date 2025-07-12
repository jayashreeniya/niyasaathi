#!/bin/bash

# NIYAsaathi Firebase Deployment Script

echo "🚀 Starting NIYAsaathi Firebase Deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please login first:"
    echo "firebase login"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd firebase/functions
npm install
cd ../..

# Set environment variables (if not already set)
echo "🔧 Setting up environment variables..."
read -p "Enter your OpenAI API key: " OPENAI_API_KEY
firebase functions:config:set openai.api_key="$OPENAI_API_KEY"

# Deploy to Firebase
echo "🚀 Deploying to Firebase..."
firebase deploy

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your app is now live at:"
echo "   - https://$(firebase use --json | jq -r '.current')-$(firebase projects:list --json | jq -r '.result[] | select(.projectId == "'$(firebase use --json | jq -r '.current')'") | .projectId').web.app"
echo ""
echo "📊 Monitor your app at:"
echo "   - https://console.firebase.google.com/project/$(firebase use --json | jq -r '.current')"
echo ""
echo "🔍 View function logs:"
echo "   firebase functions:log" 
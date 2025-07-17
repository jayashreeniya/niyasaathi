# NIYAsaathi Firebase Deployment Guide

This guide will help you deploy the NIYAsaathi loneliness coach application to Firebase.

## Prerequisites

1. **Firebase CLI**: Install Firebase CLI globally
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Account**: Create a Firebase account and project
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use existing project: `niyasaathi-loneliness-coach`

3. **Node.js**: Ensure you have Node.js 18+ installed

## Setup Steps

### 1. Firebase Login
```bash
firebase login
```

### 2. Initialize Firebase Project (if not already done)
```bash
cd firebase
firebase init
```

### 3. Install Dependencies
```bash
cd niyasaathi
npm install
cd ..
```

## Configuration

### 1. Environment Variables
Set up your environment variables in Firebase Functions:

```bash
# OpenAI API Key
firebase functions:config:set openai.api_key="YOUR_OPENAI_API_KEY"

# Twilio Configuration (optional)
firebase functions:config:set twilio.account_sid="YOUR_TWILIO_ACCOUNT_SID"
firebase functions:config:set twilio.auth_token="YOUR_TWILIO_AUTH_TOKEN"
firebase functions:config:set twilio.phone_number="YOUR_TWILIO_PHONE_NUMBER"

# JWT Secret (optional, will use default if not set)
firebase functions:config:set jwt.secret="YOUR_JWT_SECRET"
```

### 2. Firebase Configuration
Update `frontend/firebase-config.js` with your actual Firebase project configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "niyasaathi-loneliness-coach.firebaseapp.com",
  projectId: "niyasaathi-loneliness-coach",
  storageBucket: "niyasaathi-loneliness-coach.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Deployment

### Option 1: Using PowerShell Script (Recommended)
```powershell
cd firebase
.\deploy.ps1
```

### Option 2: Manual Deployment
```bash
# Deploy Functions
firebase deploy --only functions

# Deploy Hosting
firebase deploy --only hosting

# Deploy Everything
firebase deploy
```

## Post-Deployment

### 1. Verify Deployment
- Functions: https://us-central1-niyasaathi-loneliness-coach.cloudfunctions.net
- Hosting: https://niyasaathi-loneliness-coach.web.app

### 2. Test the Application
1. Open the hosted URL
2. Test phone number verification
3. Test chat functionality
4. Verify AI responses

### 3. Monitor Logs
```bash
firebase functions:log
```

## Troubleshooting

### Common Issues

1. **Functions not deploying**
   - Check Node.js version (should be 18+)
   - Verify all dependencies are installed
   - Check Firebase CLI version

2. **CORS errors**
   - Functions already have CORS configured
   - Check if functions are accessible

3. **Authentication errors**
   - Verify Firebase configuration in frontend
   - Check if user is logged in to Firebase

4. **AI not responding**
   - Verify OpenAI API key is set correctly
   - Check function logs for errors

### Rollback
If you need to rollback to the local version:

1. **Backend**: The original Flask backend is backed up in `backend.backup/`
2. **Frontend**: The original frontend is backed up in `frontend.backup/`
3. **Firebase Functions**: Original functions are in `firebase/niyasaathi/index.js.backup`

## File Structure

```
firebase/
├── niyasaathi/           # Firebase Functions
│   ├── index.js         # Main functions file
│   ├── data/            # JSON data files
│   │   ├── questions.json
│   │   ├── interventions.json
│   │   └── loneliness_script.json
│   └── package.json     # Dependencies
├── firebase.json        # Firebase configuration
├── .firebaserc         # Project configuration
├── deploy.ps1          # Deployment script
└── DEPLOYMENT.md       # This file

frontend/               # Hosted frontend
├── index.html
├── app.js             # Updated for Firebase Functions
├── firebase-config.js # Firebase configuration
└── style.css
```

## Security Notes

1. **API Keys**: Never commit API keys to version control
2. **Environment Variables**: Use Firebase Functions config for sensitive data
3. **CORS**: Functions are configured to allow all origins for development
4. **Authentication**: JWT tokens are used for user authentication

## Cost Considerations

- **Firebase Functions**: Pay per invocation and compute time
- **Firestore**: Pay per read/write operation
- **Hosting**: Free tier available
- **Twilio**: Pay per SMS sent

## Support

If you encounter issues:
1. Check Firebase Console for errors
2. Review function logs
3. Verify all configuration steps
4. Test with Firebase emulators first 
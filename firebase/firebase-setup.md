# Firebase Backend Setup for NIYAsaathi

This guide will help you set up the complete Firebase backend for the NIYAsaathi loneliness coach application.

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **Firebase CLI** - Install globally:
   ```bash
   npm install -g firebase-tools
   ```
3. **Google Cloud Project** - You'll need a Google Cloud account

## Step 1: Firebase Project Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `niyasaathi-loneliness-coach`
4. Enable Google Analytics (optional)
5. Click "Create project"

### 1.2 Enable Services
In your Firebase project, enable these services:

#### Authentication
1. Go to Authentication > Sign-in method
2. Enable "Phone" provider
3. Add your test phone numbers if needed

#### Firestore Database
1. Go to Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (we'll add security rules later)
4. Select a location close to your users

#### Functions
1. Go to Functions
2. Click "Get started"
3. Choose Node.js 18
4. Select a location

## Step 2: Local Setup

### 2.1 Login to Firebase
```bash
firebase login
```

### 2.2 Initialize Project
Navigate to the `firebase` directory and run:
```bash
cd firebase
firebase init
```

Select these options:
- **Which Firebase features do you want to set up?**
  - ☑ Functions
  - ☑ Firestore
  - ☑ Hosting
  - ☑ Emulators

- **Please select an option:**
  - Use an existing project

- **Select a default Firebase project:**
  - Choose your `niyasaathi-loneliness-coach` project

- **What language would you like to use to write Cloud Functions?**
  - JavaScript

- **Do you want to use ESLint to catch probable bugs and enforce style?**
  - Yes

- **Do you want to install dependencies with npm now?**
  - Yes

- **What do you want to use as your public directory?**
  - ../frontend

- **Configure as a single-page app (rewrite all urls to /index.html)?**
  - Yes

- **Set up automatic builds and deploys with GitHub?**
  - No

- **Which Firebase emulators do you want to set up?**
  - ☑ Authentication
  - ☑ Functions
  - ☑ Firestore
  - ☑ Hosting

- **Which port do you want to use for the auth emulator?**
  - 9099

- **Which port do you want to use for the functions emulator?**
  - 5001

- **Which port do you want to use for the firestore emulator?**
  - 8080

- **Which port do you want to use for the hosting emulator?**
  - 5000

- **Would you like to enable the Emulator UI?**
  - Yes

- **Which port do you want to use for the Emulator UI?**
  - 4000

## Step 3: Environment Configuration

### 3.1 Set Environment Variables
1. Copy `functions/env.example` to `functions/.env`
2. Fill in your actual values:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_actual_twilio_sid
TWILIO_AUTH_TOKEN=your_actual_twilio_token
TWILIO_PHONE_NUMBER=+14155238886

# Admin Secret (generate a secure random string)
ADMIN_SECRET=your_secure_admin_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Firebase Configuration
FIREBASE_PROJECT_ID=niyasaathi-loneliness-coach
```

### 3.2 Set Firebase Functions Environment Variables
```bash
firebase functions:config:set twilio.account_sid="your_twilio_sid"
firebase functions:config:set twilio.auth_token="your_twilio_token"
firebase functions:config:set twilio.phone_number="+14155238886"
firebase functions:config:set admin.secret="your_admin_secret"
firebase functions:config:set openai.api_key="your_openai_key"
```

## Step 4: Deploy Security Rules and Indexes

### 4.1 Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 4.2 Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

## Step 5: Deploy Functions

### 5.1 Install Dependencies
```bash
cd functions
npm install
```

### 5.2 Deploy Functions
```bash
firebase deploy --only functions
```

## Step 6: Test Setup

### 6.1 Start Emulators (for local development)
```bash
firebase emulators:start
```

This will start:
- Authentication emulator: http://localhost:9099
- Functions emulator: http://localhost:5001
- Firestore emulator: http://localhost:8080
- Hosting emulator: http://localhost:5000
- Emulator UI: http://localhost:4000

### 6.2 Test Functions
You can test the functions using the Emulator UI or curl:

```bash
# Test nudge registration
curl -X POST http://localhost:5001/niyasaathi-loneliness-coach/us-central1/registerNudge \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "phone_number": "+1234567890",
    "message": "Test nudge message",
    "intervention_type": "general_loneliness"
  }'
```

## Step 7: Production Deployment

### 7.1 Deploy Everything
```bash
firebase deploy
```

This will deploy:
- Functions
- Firestore rules and indexes
- Hosting (frontend)

### 7.2 Verify Deployment
1. Check Functions in Firebase Console
2. Verify Firestore rules are active
3. Test the hosted application

## Step 8: Monitoring and Logs

### 8.1 View Function Logs
```bash
firebase functions:log
```

### 8.2 Monitor in Firebase Console
- Go to Functions > Logs
- Go to Firestore > Usage
- Go to Authentication > Users

## Troubleshooting

### Common Issues

1. **Functions deployment fails**
   - Check Node.js version (should be 18+)
   - Verify all dependencies are installed
   - Check environment variables are set

2. **Firestore rules deployment fails**
   - Verify syntax in `firestore.rules`
   - Check for typos in field names

3. **Authentication issues**
   - Verify phone provider is enabled
   - Check test phone numbers are added

4. **Twilio integration issues**
   - Verify Twilio credentials
   - Check phone number format
   - Ensure Twilio account has SMS capabilities

### Getting Help

- Firebase Documentation: https://firebase.google.com/docs
- Firebase Support: https://firebase.google.com/support
- Twilio Documentation: https://www.twilio.com/docs

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **Firestore Rules**: Regularly review and update security rules
3. **Function Permissions**: Ensure functions only access necessary data
4. **API Keys**: Rotate API keys regularly
5. **Phone Numbers**: Validate and sanitize phone numbers

## Next Steps

After completing this setup:

1. Configure your frontend to use the Firebase configuration
2. Set up CI/CD pipeline if needed
3. Configure monitoring and alerting
4. Set up backup strategies
5. Plan for scaling as user base grows 
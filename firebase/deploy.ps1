# Firebase Deployment Script for NIYAsaathi
# This script deploys the Firebase Functions and Hosting

Write-Host "🚀 Starting NIYAsaathi Firebase Deployment..." -ForegroundColor Green

# Check if Firebase CLI is installed
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the correct directory
if (-not (Test-Path "firebase.json")) {
    Write-Host "❌ firebase.json not found. Please run this script from the firebase directory." -ForegroundColor Red
    exit 1
}

# Check if user is logged in to Firebase
try {
    $currentUser = firebase projects:list
    if ($currentUser -like "*No projects found*") {
        Write-Host "❌ Not logged in to Firebase. Please run: firebase login" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Logged in to Firebase" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase authentication error. Please run: firebase login" -ForegroundColor Red
    exit 1
}

# Set up environment variables from .env file
Write-Host "🔧 Setting up environment variables..." -ForegroundColor Yellow
if (Test-Path "..\.env") {
    Write-Host "📖 Found .env file, setting up Firebase Functions configuration..." -ForegroundColor Cyan
    .\setup-firebase-env.ps1
} else {
    Write-Host "⚠️  No .env file found. Please set up environment variables manually:" -ForegroundColor Yellow
    Write-Host "   firebase functions:config:set openai.api_key='YOUR_OPENAI_API_KEY'" -ForegroundColor White
    Write-Host "   firebase functions:config:set twilio.account_sid='YOUR_TWILIO_SID'" -ForegroundColor White
    Write-Host "   firebase functions:config:set twilio.auth_token='YOUR_TWILIO_AUTH_TOKEN'" -ForegroundColor White
    Write-Host "   firebase functions:config:set twilio.phone_number='YOUR_TWILIO_PHONE'" -ForegroundColor White
}

# Install dependencies for Firebase Functions
Write-Host "📦 Installing Firebase Functions dependencies..." -ForegroundColor Yellow
Set-Location niyasaathi
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Deploy Firebase Functions
Write-Host "🔥 Deploying Firebase Functions..." -ForegroundColor Yellow
firebase deploy --only functions
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy Firebase Functions" -ForegroundColor Red
    exit 1
}

# Deploy Firebase Hosting
Write-Host "🌐 Deploying Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy Firebase Hosting" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌍 Your app should be available at: https://niyasaathi-loneliness-coach.web.app" -ForegroundColor Cyan
Write-Host "🔧 Firebase Functions are available at: https://us-central1-niyasaathi-loneliness-coach.cloudfunctions.net" -ForegroundColor Cyan

Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Update the Firebase configuration in frontend/firebase-config.js with your actual API keys" -ForegroundColor White
Write-Host "2. Set up environment variables in Firebase Functions:" -ForegroundColor White
Write-Host "   firebase functions:config:set openai.api_key='YOUR_OPENAI_API_KEY'" -ForegroundColor White
Write-Host "   firebase functions:config:set twilio.account_sid='YOUR_TWILIO_SID'" -ForegroundColor White
Write-Host "   firebase functions:config:set twilio.auth_token='YOUR_TWILIO_AUTH_TOKEN'" -ForegroundColor White
Write-Host "   firebase functions:config:set twilio.phone_number='YOUR_TWILIO_PHONE'" -ForegroundColor White
Write-Host "3. Test the deployed application" -ForegroundColor White 
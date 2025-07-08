# NIYAsaathi Environment Setup Script
# This script helps you set up environment variables for Firebase Functions

Write-Host "🔧 Setting up environment variables for NIYAsaathi..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Get configuration values from user
$TWILIO_SID = Read-Host "Enter your Twilio Account SID"
$TWILIO_TOKEN = Read-Host "Enter your Twilio Auth Token" -AsSecureString
$TWILIO_PHONE = Read-Host "Enter your Twilio Phone Number (e.g., +14155238886)"
$OPENAI_KEY = Read-Host "Enter your OpenAI API Key" -AsSecureString
$ADMIN_SECRET = Read-Host "Enter your Admin Secret (generate a secure random string)" -AsSecureString

# Convert secure strings to plain text
$TWILIO_TOKEN_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($TWILIO_TOKEN))
$OPENAI_KEY_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($OPENAI_KEY))
$ADMIN_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ADMIN_SECRET))

# Set Firebase Functions config
Write-Host "Setting Firebase Functions configuration..." -ForegroundColor Yellow
firebase functions:config:set twilio.account_sid="$TWILIO_SID"
firebase functions:config:set twilio.auth_token="$TWILIO_TOKEN_PLAIN"
firebase functions:config:set twilio.phone_number="$TWILIO_PHONE"
firebase functions:config:set openai.api_key="$OPENAI_KEY_PLAIN"
firebase functions:config:set admin.secret="$ADMIN_SECRET_PLAIN"

# Create .env file
Write-Host "Creating .env file..." -ForegroundColor Yellow
$envContent = @"
# Twilio Configuration
TWILIO_ACCOUNT_SID=$TWILIO_SID
TWILIO_AUTH_TOKEN=$TWILIO_TOKEN_PLAIN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE

# Admin Secret for API endpoints
ADMIN_SECRET=$ADMIN_SECRET_PLAIN

# OpenAI Configuration
OPENAI_API_KEY=$OPENAI_KEY_PLAIN

# Firebase Configuration
FIREBASE_PROJECT_ID=niyasaathi-loneliness-coach
"@

$envContent | Out-File -FilePath "niyasaathi\.env" -Encoding UTF8

Write-Host "✅ Environment variables configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy functions: firebase deploy --only functions" -ForegroundColor White
Write-Host "2. Test locally: firebase emulators:start" -ForegroundColor White
Write-Host "3. Deploy hosting: firebase deploy --only hosting" -ForegroundColor White 
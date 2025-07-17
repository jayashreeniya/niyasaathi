# Firebase Environment Setup Script for NIYAsaathi
# This script reads the .env file and sets up Firebase Functions configuration

Write-Host "🔧 Setting up Firebase Functions environment variables..." -ForegroundColor Green

# Check if .env file exists in parent directory
$envFile = "..\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found in parent directory" -ForegroundColor Red
    exit 1
}

# Read .env file
Write-Host "📖 Reading .env file..." -ForegroundColor Yellow
$envContent = Get-Content $envFile

# Parse environment variables
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Check if Firebase CLI is available
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
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

Write-Host "`n🔐 Setting up Firebase Functions configuration..." -ForegroundColor Yellow

# Set OpenAI API Key
if ($envVars.ContainsKey("OPENAI_API_KEY")) {
    Write-Host "Setting OpenAI API Key..." -ForegroundColor Cyan
    firebase functions:config:set openai.api_key="$($envVars['OPENAI_API_KEY'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ OpenAI API Key configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set OpenAI API Key" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  OPENAI_API_KEY not found in .env file" -ForegroundColor Yellow
}

# Set Twilio Configuration
if ($envVars.ContainsKey("TWILIO_ACCOUNT_SID")) {
    Write-Host "Setting Twilio Account SID..." -ForegroundColor Cyan
    firebase functions:config:set twilio.account_sid="$($envVars['TWILIO_ACCOUNT_SID'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Twilio Account SID configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set Twilio Account SID" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  TWILIO_ACCOUNT_SID not found in .env file" -ForegroundColor Yellow
}

if ($envVars.ContainsKey("TWILIO_AUTH_TOKEN")) {
    Write-Host "Setting Twilio Auth Token..." -ForegroundColor Cyan
    firebase functions:config:set twilio.auth_token="$($envVars['TWILIO_AUTH_TOKEN'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Twilio Auth Token configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set Twilio Auth Token" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  TWILIO_AUTH_TOKEN not found in .env file" -ForegroundColor Yellow
}

if ($envVars.ContainsKey("TWILIO_PHONE_NUMBER")) {
    Write-Host "Setting Twilio Phone Number..." -ForegroundColor Cyan
    firebase functions:config:set twilio.phone_number="$($envVars['TWILIO_PHONE_NUMBER'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Twilio Phone Number configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set Twilio Phone Number" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  TWILIO_PHONE_NUMBER not found in .env file" -ForegroundColor Yellow
}

# Set JWT Secret
if ($envVars.ContainsKey("JWT_SECRET_KEY")) {
    Write-Host "Setting JWT Secret..." -ForegroundColor Cyan
    firebase functions:config:set jwt.secret="$($envVars['JWT_SECRET_KEY'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ JWT Secret configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set JWT Secret" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  JWT_SECRET_KEY not found in .env file" -ForegroundColor Yellow
}

# Set Azure Speech Configuration (if needed for future use)
if ($envVars.ContainsKey("AZURE_SPEECH_KEY")) {
    Write-Host "Setting Azure Speech Key..." -ForegroundColor Cyan
    firebase functions:config:set azure.speech_key="$($envVars['AZURE_SPEECH_KEY'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Azure Speech Key configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set Azure Speech Key" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  AZURE_SPEECH_KEY not found in .env file" -ForegroundColor Yellow
}

if ($envVars.ContainsKey("AZURE_SPEECH_REGION")) {
    Write-Host "Setting Azure Speech Region..." -ForegroundColor Cyan
    firebase functions:config:set azure.speech_region="$($envVars['AZURE_SPEECH_REGION'])"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Azure Speech Region configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set Azure Speech Region" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  AZURE_SPEECH_REGION not found in .env file" -ForegroundColor Yellow
}

Write-Host "`n✅ Firebase Functions environment setup completed!" -ForegroundColor Green

# Show current configuration
Write-Host "`n📋 Current Firebase Functions configuration:" -ForegroundColor Yellow
firebase functions:config:get

Write-Host "`n🚀 Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy Firebase Functions: firebase deploy --only functions" -ForegroundColor White
Write-Host "2. Deploy Firebase Hosting: firebase deploy --only hosting" -ForegroundColor White
Write-Host "3. Or use the deployment script: .\deploy.ps1" -ForegroundColor White

Write-Host "`n⚠️  Security Note: These environment variables are now stored securely in Firebase Functions configuration." -ForegroundColor Yellow
Write-Host "   They are encrypted and only accessible to your Firebase Functions." -ForegroundColor Yellow 
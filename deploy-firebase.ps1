# NIYAsaathi Firebase Deployment Script (PowerShell)

Write-Host "🚀 Starting NIYAsaathi Firebase Deployment..." -ForegroundColor Green

# Check if Firebase CLI is installed
try {
    $null = Get-Command firebase -ErrorAction Stop
} catch {
    Write-Host "❌ Firebase CLI is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in
try {
    $null = firebase projects:list 2>$null
} catch {
    Write-Host "❌ Not logged in to Firebase. Please login first:" -ForegroundColor Red
    Write-Host "firebase login" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
Set-Location firebase/functions
npm install
Set-Location ../..

# Set environment variables
Write-Host "🔧 Setting up environment variables..." -ForegroundColor Blue
$OPENAI_API_KEY = Read-Host "Enter your OpenAI API key"
firebase functions:config:set openai.api_key="$OPENAI_API_KEY"

# Deploy to Firebase
Write-Host "🚀 Deploying to Firebase..." -ForegroundColor Green
firebase deploy

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your app is now live at:" -ForegroundColor Cyan
Write-Host "   - https://your-project-id.web.app" -ForegroundColor Yellow
Write-Host ""
Write-Host "📊 Monitor your app at:" -ForegroundColor Cyan
Write-Host "   - https://console.firebase.google.com/project/your-project-id" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 View function logs:" -ForegroundColor Cyan
Write-Host "   firebase functions:log" -ForegroundColor Yellow 
# NIYAsaathi Backend Server Startup Script (Safe Version)
# This script starts the Flask backend server with proper error handling

Write-Host "🚀 Starting NIYAsaathi Backend Server..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Get the script directory and set backend path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"

Write-Host "📁 Backend directory: $backendDir" -ForegroundColor Cyan

# Check if backend directory exists
if (-not (Test-Path $backendDir)) {
    Write-Host "❌ Backend directory not found at: $backendDir" -ForegroundColor Red
    exit 1
}

# Change to backend directory
Set-Location -Path $backendDir
Write-Host "✅ Changed to backend directory" -ForegroundColor Green

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python and try again." -ForegroundColor Red
    exit 1
}

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "📦 Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "🔧 Activating virtual environment..." -ForegroundColor Yellow
$venvScript = Join-Path $backendDir "venv\Scripts\Activate.ps1"
if (Test-Path $venvScript) {
    & $venvScript
} else {
    Write-Host "❌ Virtual environment activation script not found" -ForegroundColor Red
    exit 1
}

# Check if Azure TTS is available
Write-Host "🔍 Checking Azure TTS availability..." -ForegroundColor Yellow
try {
    python -c "import azure.cognitiveservices.speech; print('Azure TTS available')" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Azure TTS is available" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Azure TTS not available - speech synthesis will be disabled" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Azure TTS not available - speech synthesis will be disabled" -ForegroundColor Yellow
}

# Start the Flask server
Write-Host "🌐 Starting Flask server on http://localhost:5000..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server with error handling
try {
    python app.py
} catch {
    Write-Host "❌ Error starting Flask server: $_" -ForegroundColor Red
    Write-Host "Check the error message above for details." -ForegroundColor Yellow
} 
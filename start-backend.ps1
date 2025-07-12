# NIYAsaathi Backend Server Startup Script
# This script starts the Flask backend server

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

# Check if requirements are installed
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

# Install requirements if needed
if (-not (Test-Path "venv\Lib\site-packages\flask")) {
    Write-Host "📦 Installing requirements..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# Start the Flask server
Write-Host "🌐 Starting Flask server on http://localhost:5000..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python app.py 
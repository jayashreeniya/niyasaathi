# NIYAsaathi Frontend Server Startup Script
# This script starts the frontend server using Python's built-in HTTP server

Write-Host "🎨 Starting NIYAsaathi Frontend Server..." -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

# Get the script directory and set frontend path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $scriptDir "frontend"

Write-Host "📁 Frontend directory: $frontendDir" -ForegroundColor Cyan

# Check if frontend directory exists
if (-not (Test-Path $frontendDir)) {
    Write-Host "❌ Frontend directory not found at: $frontendDir" -ForegroundColor Red
    exit 1
}

# Change to frontend directory
Set-Location -Path $frontendDir
Write-Host "✅ Changed to frontend directory" -ForegroundColor Green

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python and try again." -ForegroundColor Red
    exit 1
}

# Check if index.html exists
if (-not (Test-Path "index.html")) {
    Write-Host "❌ index.html not found in frontend directory!" -ForegroundColor Red
    exit 1
}

# Start the HTTP server
Write-Host "🌐 Starting HTTP server on http://localhost:8000..." -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:8000" -ForegroundColor White
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python -m http.server 8000 
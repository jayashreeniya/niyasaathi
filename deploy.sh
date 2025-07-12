#!/bin/bash

# NIYAsaathi Deployment Script

echo "🚀 Deploying NIYAsaathi..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your configuration before deploying."
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Start the server
echo "🌟 Starting NIYAsaathi server..."
echo "📱 Frontend: http://localhost:3000"
echo "🔗 Backend API: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"

npm start 
#!/usr/bin/env python3
"""
NIYAsaathi Setup Script
Automates the installation and configuration of the NIYAsaathi loneliness coach.
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def print_banner():
    """Print the NIYAsaathi banner"""
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║                    NIYAsaathi Setup                         ║
    ║              Your Empathetic Loneliness Coach                ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

def check_prerequisites():
    """Check if required software is installed"""
    print("🔍 Checking prerequisites...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        return False
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Node.js {result.stdout.strip()} detected")
        else:
            print("❌ Node.js is required")
            return False
    except FileNotFoundError:
        print("❌ Node.js is required")
        return False
    
    # Check npm
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ npm {result.stdout.strip()} detected")
        else:
            print("❌ npm is required")
            return False
    except FileNotFoundError:
        print("❌ npm is required")
        return False
    
    return True

def install_backend_dependencies():
    """Install Python dependencies for the backend"""
    print("\n🐍 Installing backend dependencies...")
    
    backend_path = Path("backend")
    if not backend_path.exists():
        print("❌ Backend directory not found")
        return False
    
    requirements_file = backend_path / "requirements.txt"
    if not requirements_file.exists():
        print("❌ requirements.txt not found")
        return False
    
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)], check=True)
        print("✅ Backend dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install backend dependencies: {e}")
        return False

def install_firebase_dependencies():
    """Install Node.js dependencies for Firebase Functions"""
    print("\n🔥 Installing Firebase Functions dependencies...")
    
    firebase_path = Path("firebase/functions")
    if not firebase_path.exists():
        print("❌ Firebase Functions directory not found")
        return False
    
    package_json = firebase_path / "package.json"
    if not package_json.exists():
        print("❌ package.json not found")
        return False
    
    try:
        subprocess.run(["npm", "install"], cwd=firebase_path, check=True)
        print("✅ Firebase Functions dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install Firebase Functions dependencies: {e}")
        return False

def create_env_file():
    """Create .env file with required environment variables"""
    print("\n🔧 Creating environment configuration...")
    
    env_content = """# NIYAsaathi Environment Configuration

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Security Keys
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Firebase Configuration
FIREBASE_CREDENTIALS_PATH=firebase_credentials.json

# Twilio Configuration (for SMS)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Development Settings
FLASK_ENV=development
DEBUG=True
"""
    
    env_file = Path(".env")
    if env_file.exists():
        print("⚠️  .env file already exists. Skipping creation.")
    else:
        with open(env_file, "w") as f:
            f.write(env_content)
        print("✅ .env file created successfully")
        print("📝 Please update the .env file with your actual API keys and credentials")

def print_next_steps():
    """Print next steps for the user"""
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║                    Setup Complete! 🎉                        ║
    ╚══════════════════════════════════════════════════════════════╝
    
    📋 Next Steps:
    
    1. 🔑 Configure API Keys:
       - Update .env file with your actual API keys
       - Get OpenAI API key from: https://platform.openai.com/
       - Get Twilio credentials from: https://www.twilio.com/
    
    2. 🔥 Firebase Setup:
       - Create a Firebase project at: https://console.firebase.google.com/
       - Enable Firestore Database
       - Enable Authentication (Phone provider)
       - Download service account key to backend/firebase_credentials.json
    
    3. 🚀 Start Development:
       - Backend: cd backend && python app.py
       - Frontend: Open frontend/index.html in browser
       - Functions: cd firebase/functions && firebase deploy
    
    4. 📱 Test the Application:
       - Visit the frontend URL
       - Test phone authentication
       - Try voice features
       - Complete a conversation flow
    
    📚 Documentation: README.md
    🆘 Support: Check the README for troubleshooting
    
    Happy coding! 💙
    """)

def main():
    """Main setup function"""
    print_banner()
    
    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites check failed. Please install required software.")
        sys.exit(1)
    
    # Install dependencies
    if not install_backend_dependencies():
        print("\n❌ Backend setup failed.")
        sys.exit(1)
    
    if not install_firebase_dependencies():
        print("\n❌ Firebase setup failed.")
        sys.exit(1)
    
    # Create configuration files
    create_env_file()
    
    # Print next steps
    print_next_steps()

if __name__ == "__main__":
    main() 
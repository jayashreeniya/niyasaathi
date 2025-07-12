# NIYAsaathi - Your Empathetic Loneliness Coach

NIYAsaathi is an AI-powered loneliness coach designed with compassion and understanding to help you navigate feelings of loneliness and find connection within yourself.

## 🌟 Features

- **Empathetic Conversations**: AI coach trained to provide compassionate, judgment-free support
- **Multi-Stage Interventions**: Personalized therapeutic interventions based on your specific loneliness type
- **Voice Interaction**: Natural voice input and output for a more human-like experience
- **Conversation History**: Track and revisit your therapeutic journey
- **24/7 Availability**: Support whenever you need it
- **Privacy-First**: Your conversations are private and secure

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- Python 3.8+ (for backend)
- OpenAI API key
- Azure Speech Services (optional, for voice features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/niyasaathi.git
   cd niyasaathi
   ```

2. **Install dependencies**
   ```bash
   # Install Node.js dependencies
   npm install
   
   # Install Python dependencies
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start the backend**
   ```bash
   cd backend
   python app.py
   ```

5. **Start the frontend**
   ```bash
   npm start
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🌐 Deployment

### Firebase Deployment (Recommended)

NIYAsaathi is configured for Firebase Hosting and Cloud Functions deployment.

#### Quick Start
1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Run deployment script**
   - **Windows**: `.\deploy-firebase.ps1`
   - **Mac/Linux**: `./deploy-firebase.sh`

#### Manual Deployment
1. **Install dependencies**
   ```bash
   cd firebase/functions
   npm install
   ```

2. **Set environment variables**
   ```bash
   firebase functions:config:set openai.api_key="your-openai-api-key"
   ```

3. **Deploy**
   ```bash
   firebase deploy
   ```

### Other Deployment Options

#### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Set environment variables in Vercel dashboard

#### Heroku
1. Create Heroku app: `heroku create your-app-name`
2. Set environment variables
3. Deploy: `git push heroku main`

#### Netlify
1. Build: `npm run build`
2. Deploy to Netlify dashboard
3. Set build command: `npm run build`
4. Set publish directory: `frontend`

For detailed instructions, see [FIREBASE_DEPLOYMENT_GUIDE.md](FIREBASE_DEPLOYMENT_GUIDE.md) and [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## 🏗️ Architecture

```
niyasaathi/
├── frontend/          # React/HTML/CSS frontend
├── backend/           # Python Flask API
├── agent/            # AI agent logic and scripts
├── server.js         # Production server
├── package.json      # Node.js dependencies
└── README.md         # This file
```

## 🎨 Design System

NIYAsaathi uses a modern, accessible design system with:

- **Color Palette**: Purple-based theme (#8B5CF6)
- **Typography**: Inter font family
- **Components**: Consistent button styles, modals, and forms
- **Responsive**: Mobile-first design approach

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI responses | Yes |
| `AZURE_SPEECH_KEY` | Azure Speech Services key | No |
| `AZURE_SPEECH_REGION` | Azure Speech Services region | No |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for SMS | No |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | No |
| `BACKEND_URL` | Backend API URL | Yes |

### Backend Configuration

The backend runs on Flask and provides:
- User authentication via phone number
- AI conversation processing
- Text-to-speech generation
- SMS notifications (optional)

## 📱 Features in Detail

### Landing Page
- Modern, welcoming design
- Feature highlights
- Trust indicators
- Call-to-action to start journey

### Authentication
- Phone number verification
- Secure token-based authentication
- User data persistence

### Chat Interface
- Real-time messaging
- Voice input/output
- Typing indicators
- Message history

### Interventions
- Multi-stage therapeutic interventions
- Personalized based on loneliness type
- Action items and reminders
- Progress tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you need help or have questions:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Azure for Speech Services
- Inter font family
- Font Awesome for icons

---

**Made with 💜 for those who need support**

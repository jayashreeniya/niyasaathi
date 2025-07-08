# NIYAsaathi - Your Empathetic Loneliness Coach

NIYAsaathi is an AI-powered loneliness coach that provides empathetic, structured support through text and voice interactions. Built with modern web technologies and AI integration, it offers personalized conversation flows and follow-up nudges to help users navigate feelings of loneliness.

## 🌟 Features

### Core Functionality
- **Empathetic AI Conversations**: Powered by OpenAI GPT-4 with structured loneliness coaching
- **Voice Input/Output**: Speech-to-text and text-to-speech capabilities
- **Phone Number Authentication**: Secure login with SMS verification
- **Conversation Memory**: Remembers user progress and continues from where they left off
- **Personalized Interventions**: Tailored support based on specific loneliness causes
- **Follow-up Nudges**: Automated SMS reminders for suggested actions

### Conversation Flow
- **Screening Questions**: Initial assessment of loneliness experience
- **Impact Analysis**: Understanding how loneliness affects daily life
- **Cause Identification**: Exploring root causes (social anxiety, relationship loss, etc.)
- **Intervention Guidance**: Personalized suggestions and actionable steps
- **Progress Tracking**: Continuous support and follow-up

### Technical Features
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Chat**: Instant message processing and responses
- **Voice Controls**: Toggle voice input/output with customizable settings
- **Session Management**: Secure JWT-based authentication
- **Data Persistence**: Firebase Firestore integration for user data
- **SMS Integration**: Twilio-powered follow-up messages

## 🏗️ Architecture

```
NIYAsaathi/
├── frontend/           # React-like chat interface with voice
├── backend/           # Flask API with AI integration
├── agent/             # AI agent with conversation logic
├── firebase/          # Firebase Functions for nudges
└── docs/              # Documentation and setup guides
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- Firebase account
- OpenAI API key
- Twilio account (for SMS)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd niyalonelinesscoach
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY="your-openai-api-key"
export SECRET_KEY="your-secret-key"
export JWT_SECRET_KEY="your-jwt-secret"

# Run the backend
python app.py
```

### 3. Frontend Setup
```bash
cd frontend
# Open index.html in a web browser
# Or serve with a local server:
python -m http.server 8000
```

### 4. Firebase Setup
```bash
cd firebase/functions
npm install
firebase deploy --only functions
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
OPENAI_API_KEY=your-openai-api-key
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
FIREBASE_CREDENTIALS_PATH=path/to/firebase-credentials.json
```

#### Firebase Functions
```env
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
ADMIN_SECRET=your-admin-secret
```

### Firebase Configuration
1. Create a Firebase project
2. Enable Firestore Database
3. Enable Authentication (Phone provider)
4. Download service account key to `backend/firebase_credentials.json`

## 📱 Usage

### For Users
1. **Access the Application**: Open the frontend in a web browser
2. **Phone Authentication**: Enter your phone number and verify with SMS code
3. **Start Conversation**: Begin chatting with NIYAsaathi
4. **Voice Interaction**: Use microphone button for voice input/output
5. **Receive Support**: Get personalized guidance and follow-up nudges

### For Developers
1. **Local Development**: Run backend on `localhost:5000`
2. **API Testing**: Use the `/health` endpoint to check system status
3. **Voice Testing**: Ensure microphone permissions are granted
4. **Database**: Check Firebase console for user data and nudge logs

## 🔌 API Endpoints

### Authentication
- `POST /auth/send-code` - Send verification code
- `POST /auth/verify-code` - Verify phone number

### Chat
- `POST /message` - Send message and get AI response
- `GET /user/data` - Get user conversation data
- `POST /save_state` - Save user state

### Nudges
- `POST /register_nudge` - Schedule follow-up nudge
- `GET /health` - System health check

## 🎯 Conversation Flow

### Screening Phase (q1-q4)
- Initial loneliness assessment
- Understanding user's experience
- Identifying patterns and triggers

### Impact Phase (q5-q7)
- Exploring daily life effects
- Understanding relationship impacts
- Assessing functional changes

### Causes Phase (q8-q10)
- Identifying root causes
- Recent life changes
- Social interaction patterns

### Intervention Phase
- **Social Anxiety Branch**: Specific guidance for social challenges
- **Relationship Loss Branch**: Support for grief and loss
- **General Loneliness**: Universal connection strategies

## 🤖 AI Agent Features

### Memory Management
- Tracks conversation history
- Remembers user progress
- Maintains context across sessions

### Emotional Intelligence
- Validates user feelings
- Provides empathetic responses
- Adapts tone to user needs

### Structured Guidance
- Follows evidence-based conversation flow
- Provides actionable suggestions
- Schedules appropriate follow-ups

## 📊 Monitoring and Analytics

### Firebase Functions
- Nudge delivery tracking
- Success/failure rates
- Intervention type statistics

### User Analytics
- Conversation completion rates
- Most common loneliness causes
- Intervention effectiveness

## 🔒 Security & Privacy

### Data Protection
- JWT-based authentication
- Encrypted data transmission
- Secure phone number handling

### Privacy Features
- Local storage for settings
- Optional voice features
- User-controlled data retention

## 🚀 Deployment

### Production Setup
1. **Backend**: Deploy to Heroku, AWS, or Google Cloud
2. **Frontend**: Deploy to Firebase Hosting or Netlify
3. **Database**: Use Firebase Firestore
4. **Functions**: Deploy Firebase Functions

### Environment Configuration
```bash
# Production environment variables
export FLASK_ENV=production
export OPENAI_API_KEY=prod-openai-key
export FIREBASE_PROJECT_ID=your-project-id
```

## 🧪 Testing

### Manual Testing
1. **Authentication Flow**: Test phone verification
2. **Conversation Flow**: Complete full conversation cycle
3. **Voice Features**: Test speech recognition and synthesis
4. **Nudge System**: Verify SMS delivery

### Automated Testing
```bash
# Backend tests
cd backend
python -m pytest tests/

# Frontend tests
cd frontend
npm test
```

## 🤝 Contributing

### Development Guidelines
1. Follow existing code structure
2. Add comprehensive error handling
3. Include voice accessibility features
4. Maintain empathetic tone in AI responses

### Code Style
- Python: PEP 8 compliance
- JavaScript: ESLint configuration
- HTML/CSS: Semantic markup and responsive design

## 📞 Support

### Technical Issues
- Check `/health` endpoint for system status
- Review Firebase console for errors
- Verify environment variables

### User Support
- Ensure microphone permissions
- Check browser compatibility
- Verify phone number format

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for AI capabilities
- Twilio for SMS integration
- Firebase for backend services
- Web Speech API for voice features

---

**NIYAsaathi** - Walking with you through loneliness, one step at a time. 💙

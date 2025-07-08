from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from firebase_admin import credentials, firestore, initialize_app, auth
import datetime
import os
import json
import uuid
import jwt
from functools import wraps
import sys
from dotenv import load_dotenv
import requests
sys.path.append('../agent')
from ai_agent import NIYAsaathiAgent
from nudge_system import NudgeSystem
from azure_tts import synthesize_speech

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key-here')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-jwt-secret-key-here')

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# Firebase init
try:
    cred = credentials.Certificate('firebase_credentials.json')
    initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Firebase initialization error: {e}")
    # For development, create a mock database
    db = None

# Initialize AI Agent and Nudge System
try:
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    if openai_api_key:
        ai_agent = NIYAsaathiAgent(openai_api_key)
        nudge_system = NudgeSystem()
    else:
        ai_agent = None
        nudge_system = None
        print("Warning: OPENAI_API_KEY not found. AI features will be limited.")
except Exception as e:
    print(f"AI Agent initialization error: {e}")
    ai_agent = None
    nudge_system = None

# Mock database for development (if Firebase is not available)
mock_db = {
    'users': {},
    'nudges': [],
    'verification_codes': {}
}

def generate_token(user_id):
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30),
        'iat': datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')

def token_required(f):
    """Decorator to require JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            payload = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

def get_user_data(user_id):
    """Get user data from database"""
    if db:
        try:
            doc = db.collection('users').document(user_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Error getting user data from Firebase: {e}")
    
    # Fallback to mock database
    return mock_db['users'].get(user_id, {
        'id': user_id,
        'phone_number': '',
        'current_stage': 'screening',
        'current_question': 'q1',
        'branch': None,
        'intervention_type': None,
        'conversation_history': [],
        'last_coach_message': '',
        'last_updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    })

def save_user_data(user_id, user_data):
    """Save user data to database"""
    if db:
        try:
            db.collection('users').document(user_id).set(user_data)
            return True
        except Exception as e:
            print(f"Error saving user data to Firebase: {e}")
            return False
    
    # Fallback to mock database
    mock_db['users'][user_id] = user_data
    return True

def generate_verification_code():
    """Generate a 6-digit verification code"""
    return str(uuid.uuid4().int)[:6]

def send_sms_via_twilio(to_number, message):
    """Send SMS via Twilio"""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        print("Twilio credentials not configured. SMS will not be sent.")
        return False
    
    try:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        payload = {
            'To': to_number,
            'From': TWILIO_PHONE_NUMBER,
            'Body': message
        }
        response = requests.post(url, data=payload, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
        
        if response.status_code == 201:
            print(f"SMS sent successfully to {to_number}")
            return True
        else:
            print(f"Failed to send SMS: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Error sending SMS via Twilio: {e}")
        return False

@app.route('/auth/send-code', methods=['POST'])
def send_verification_code():
    """Send verification code to phone number"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        
        if not phone_number:
            return jsonify({'error': 'Phone number is required'}), 400
        
        # Generate verification code
        code = generate_verification_code()
        
        # Store code (in production, this would be sent via SMS)
        if db:
            try:
                db.collection('verification_codes').document(phone_number).set({
                    'code': code,
                    'created_at': datetime.datetime.now(datetime.timezone.utc),
                    'expires_at': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
                })
            except Exception as e:
                print(f"Error storing verification code in Firebase: {e}")
        
        # Store in mock database
        mock_db['verification_codes'][phone_number] = {
            'code': code,
            'created_at': datetime.datetime.now(datetime.timezone.utc),
            'expires_at': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
        }
        
        # Send SMS via Twilio
        message = f"Your NIYAsaathi verification code is: {code}. This code expires in 10 minutes."
        sms_sent = send_sms_via_twilio(phone_number, message)
        
        if not sms_sent:
            # Fallback: print to console for development
            print(f"Verification code for {phone_number}: {code}")
            print("Note: SMS not sent. Check Twilio configuration.")
        else:
            print(f"Verification code sent via SMS to {phone_number}")
        
        return jsonify({'message': 'Verification code sent successfully'}), 200
        
    except Exception as e:
        print(f"Error sending verification code: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/auth/verify-code', methods=['POST'])
def verify_code():
    """Verify phone number with code"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        code = data.get('code')
        
        if not phone_number or not code:
            return jsonify({'error': 'Phone number and code are required'}), 400
        
        # Get stored verification code
        stored_data = None
        if db:
            try:
                doc = db.collection('verification_codes').document(phone_number).get()
                if doc.exists:
                    stored_data = doc.to_dict()
            except Exception as e:
                print(f"Error getting verification code from Firebase: {e}")
        
        if not stored_data:
            stored_data = mock_db['verification_codes'].get(phone_number)
        
        if not stored_data:
            return jsonify({'error': 'No verification code found for this phone number'}), 400
        
        # Check if code is expired
        expires_at = stored_data['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        
        if datetime.datetime.now(datetime.timezone.utc) > expires_at:
            return jsonify({'error': 'Verification code has expired'}), 400
        
        # Verify code
        if stored_data['code'] != code:
            return jsonify({'error': 'Invalid verification code'}), 400
        
        # Create or get user
        user_id = str(uuid.uuid4())
        user_data = get_user_data(user_id)
        
        if not user_data.get('phone_number'):
            user_data.update({
                'id': user_id,
                'phone_number': phone_number,
                'current_stage': 'screening',
                'current_question': 'q1',
                'branch': None,
                'intervention_type': None,
                'conversation_history': [],
                'last_coach_message': '',
                'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
                'last_updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
            })
            save_user_data(user_id, user_data)
        
        # Generate token
        token = generate_token(user_id)
        
        # Clean up verification code
        if db:
            try:
                db.collection('verification_codes').document(phone_number).delete()
            except Exception as e:
                print(f"Error deleting verification code from Firebase: {e}")
        
        if phone_number in mock_db['verification_codes']:
            del mock_db['verification_codes'][phone_number]
        
        return jsonify({
            'token': token,
            'user': {
                'id': user_id,
                'phone_number': phone_number
            }
        }), 200
        
    except Exception as e:
        print(f"Error verifying code: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/user/data', methods=['GET'])
@token_required
def get_user_data_endpoint(current_user_id):
    """Get user data"""
    try:
        user_data = get_user_data(current_user_id)
        return jsonify(user_data), 200
    except Exception as e:
        print(f"Error getting user data: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/message', methods=['POST'])
@token_required
def handle_message(current_user_id):
    """Handle incoming message and generate response"""
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Get user data
        user_data = get_user_data(current_user_id)
        
        # Process message with AI agent
        if ai_agent:
            try:
                result = ai_agent.process_message(user_data, user_message)
                response = result['response']
                user_data = result['user_data']
                
                # Check for action items and schedule nudges
                if result.get('action_items') and nudge_system:
                    for action_item in result['action_items']:
                        # Schedule nudge for action item
                        nudge_data = {
                            "user_id": current_user_id,
                            "phone_number": user_data.get('phone_number'),
                            "action_item_id": action_item['id'],
                            "message": f"Gentle reminder: {action_item.get('description', '')}",
                            "type": action_item.get('type', 'exercise'),
                            "send_at": datetime.datetime.fromisoformat(action_item['due_date']),
                            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
                        }
                        
                        if db:
                            try:
                                db.collection('nudges').add(nudge_data)
                            except Exception as e:
                                print(f"Error saving action item nudge to Firebase: {e}")
                        
                        # Save to mock database
                        mock_db['nudges'].append(nudge_data)
                
            except Exception as e:
                print(f"AI agent error: {e}")
                response = "I'm here with you. Can you tell me a bit more about what you're experiencing?"
        else:
            # Fallback response without AI
            response = "Thank you for sharing that with me. I'm here to listen and support you. Can you tell me more about how you're feeling?"
            user_data['conversation_history'].append({
                'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
                'coach_message': response,
                'user_message': user_message
            })
            user_data['last_coach_message'] = response
            user_data['last_updated'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        
        # Save updated user data
        save_user_data(current_user_id, user_data)
        
        return jsonify({
            'response': response,
            'user_data': user_data,
            'intervention_type': user_data.get('intervention_type'),
            'action_items': result.get('action_items', []) if ai_agent else [],
            'script_progress': user_data.get('script_progress', 0),
            'branch': user_data.get('branch')
        }), 200
        
    except Exception as e:
        print(f"Error handling message: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/save_state', methods=['POST'])
@token_required
def save_state(current_user_id):
    """Save user state"""
    try:
        data = request.json
        user_data = get_user_data(current_user_id)
        user_data.update(data)
        user_data['last_updated'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        
        save_user_data(current_user_id, user_data)
        return jsonify({"status": "saved"}), 200
    except Exception as e:
        print(f"Error saving state: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/register_nudge', methods=['POST'])
@token_required
def register_nudge(current_user_id):
    """Register a nudge for the user"""
    try:
        data = request.json
        intervention_type = data.get('intervention_type', 'general_loneliness')
        
        # Get user data to generate personalized message
        user_data = get_user_data(current_user_id)
        
        if ai_agent:
            try:
                nudge_message = ai_agent.get_follow_up_message(user_data)
            except Exception as e:
                print(f"Error generating nudge message: {e}")
                nudge_message = "How are you feeling today? Remember, I'm here to support you."
        else:
            nudge_message = "How are you feeling today? Remember, I'm here to support you."
        
        nudge_data = {
            "user_id": current_user_id,
            "phone_number": user_data.get('phone_number'),
            "message": nudge_message,
            "intervention_type": intervention_type,
            "send_at": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1),
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        }
        
        if db:
            try:
                db.collection('nudges').add(nudge_data)
            except Exception as e:
                print(f"Error saving nudge to Firebase: {e}")
        
        # Save to mock database
        mock_db['nudges'].append(nudge_data)
        
        return jsonify({"status": "nudge scheduled"}), 200
    except Exception as e:
        print(f"Error registering nudge: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/action-items', methods=['GET'])
@token_required
def get_action_items(current_user_id):
    """Get user's action items"""
    try:
        user_data = get_user_data(current_user_id)
        action_items = user_data.get('action_items', [])
        
        if nudge_system:
            progress_summary = nudge_system.get_user_progress_summary(user_data)
        else:
            progress_summary = {
                'total_items': len(action_items),
                'completed_items': sum(1 for item in action_items if item.get('completed', False)),
                'pending_items': sum(1 for item in action_items if not item.get('completed', False)),
                'completion_rate': 0.0
            }
        
        return jsonify({
            'action_items': action_items,
            'progress_summary': progress_summary
        }), 200
    except Exception as e:
        print(f"Error getting action items: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/action-items/<action_item_id>/complete', methods=['POST'])
@token_required
def complete_action_item(current_user_id, action_item_id):
    """Mark an action item as completed"""
    try:
        user_data = get_user_data(current_user_id)
        
        if nudge_system:
            nudge_system.mark_action_item_completed(user_data, action_item_id)
        else:
            # Manual completion without nudge system
            for item in user_data.get('action_items', []):
                if item.get('id') == action_item_id:
                    item['completed'] = True
                    item['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
                    break
        
        save_user_data(current_user_id, user_data)
        
        return jsonify({"status": "completed"}), 200
    except Exception as e:
        print(f"Error completing action item: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/start-loneliness-script', methods=['POST'])
@token_required
def start_loneliness_script(current_user_id):
    """Start the loneliness script conversation flow"""
    try:
        user_data = get_user_data(current_user_id)
        
        if ai_agent:
            result = ai_agent.start_loneliness_script(user_data)
            user_data = result['user_data']
            response = result['response']
            
            # Check for action items and schedule nudges
            if result.get('action_items') and nudge_system:
                for action_item in result['action_items']:
                    nudge_data = {
                        "user_id": current_user_id,
                        "phone_number": user_data.get('phone_number'),
                        "action_item_id": action_item['id'],
                        "message": f"Gentle reminder: {action_item.get('description', '')}",
                        "type": action_item.get('type', 'exercise'),
                        "send_at": datetime.datetime.fromisoformat(action_item['due_date']),
                        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
                    }
                    
                    if db:
                        try:
                            db.collection('nudges').add(nudge_data)
                        except Exception as e:
                            print(f"Error saving action item nudge to Firebase: {e}")
                    
                    mock_db['nudges'].append(nudge_data)
        else:
            response = "Hi there. How are you feeling today?"
            user_data['current_stage'] = 'loneliness_script'
            user_data['script_progress'] = 0
        
        save_user_data(current_user_id, user_data)
        
        return jsonify({
            'response': response,
            'user_data': user_data,
            'action_items': result.get('action_items', []) if ai_agent else []
        }), 200
    except Exception as e:
        print(f"Error starting loneliness script: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/pending-nudges', methods=['GET'])
@token_required
def get_pending_nudges(current_user_id):
    """Get pending nudges for the user"""
    try:
        user_data = get_user_data(current_user_id)
        
        if nudge_system:
            pending_nudges = nudge_system.check_pending_nudges(user_data)
        else:
            pending_nudges = []
        
        return jsonify({
            'pending_nudges': pending_nudges
        }), 200
    except Exception as e:
        print(f"Error getting pending nudges: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'ai_agent_available': ai_agent is not None,
        'database_available': db is not None
    }), 200

@app.route('/speak', methods=['POST'])
def speak():
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    filename = synthesize_speech(text, "response.wav")
    if filename:
        return send_file(filename, mimetype="audio/wav")
    else:
        return jsonify({'error': 'Speech synthesis failed'}), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message')
    user_id = data.get('user_id', 'test_user')
    # Retrieve or initialize user data
    user_data = get_user_data(user_id)
    # Use the real agent logic
    result = ai_agent.process_message(user_data, user_message)
    response_text = result['response']
    synthesize_speech(response_text, "response.wav")
    # Save updated user data
    save_user_data(user_id, result['user_data'])
    return jsonify({
        "text": response_text,
        "audio_url": "/speak",  # The frontend should POST the text to /speak
        "user_data": result['user_data']
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

import json
import os
from firebase_admin import initialize_app, firestore, auth
import google.cloud.texttospeech as tts
from google.cloud import texttospeech
import jwt
import datetime
import random
import string
from typing import Dict, List, Optional
import openai
import re
from flask import Flask, request, jsonify, Response
from dotenv import load_dotenv

# Load environment variables from .env file in root directory
load_dotenv('.env')

# Initialize Firebase Admin
initialize_app()

# Initialize Firestore
db = firestore.client()

# Initialize Flask app
app = Flask(__name__)

# CORS decorator to add headers to all responses
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# Apply CORS headers to all responses
@app.after_request
def after_request(response):
    return add_cors_headers(response)

# Load the working Python AI agent logic
class NIYAsaathiAgent:
    def __init__(self, openai_api_key: str):
        # Initialize OpenAI client with minimal configuration to avoid proxies issue
        import os
        # Set environment variable to avoid proxies
        os.environ['OPENAI_API_KEY'] = openai_api_key
        
        # Try to create client without any additional parameters
        try:
            # Simple initialization without any extra parameters
            self.openai_client = openai.OpenAI()
            print("✅ OpenAI client initialized successfully")
        except Exception as e:
            print(f"❌ OpenAI client initialization failed: {e}")
            # For now, set to None so we can still use the agent without OpenAI
            self.openai_client = None
            print("⚠️ AI features will be limited - using fallback responses")
        
        self.questions = self._load_questions()
        self.interventions = self._load_interventions()
        self.loneliness_script = self._load_loneliness_script()
        
    def _load_questions(self) -> Dict:
        """Load the question bank from JSON file"""
        try:
            with open('data/questions.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print("Warning: Could not find questions.json")
            return {}
    
    def _load_interventions(self) -> Dict:
        """Load intervention scripts from JSON file"""
        try:
            with open('data/interventions.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print("Warning: Could not find interventions.json")
            return {}
    
    def _load_loneliness_script(self) -> List[Dict]:
        """Load the loneliness script from JSON file"""
        try:
            with open('data/loneliness_script.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print("Warning: Could not find loneliness_script.json")
            return []

    def find_question_by_id(self, question_id: str) -> Optional[Dict]:
        """Find a question by its ID across all sections"""
        for section in self.questions.values():
            if question_id in section:
                return section[question_id]
        return None

    def _determine_next_question(self, user_data: Dict, user_response: str) -> str:
        """Determine the next question based on user response"""
        current_question = user_data.get('current_question', 'q1')
        
        # Simple keyword-based branching
        user_response_lower = user_response.lower()
        
        if current_question == 'q1':
            # After asking about loneliness, check for specific causes
            if any(word in user_response_lower for word in ['yes', 'yeah', 'yep', 'sure', 'okay', 'true']):
                return 'q2'
            else:
                return 'q2'  # Still ask follow-up even if they said no
        elif current_question == 'q2':
            # Check for specific loneliness causes
            if any(word in user_response_lower for word in ['breakup', 'divorce', 'separation', 'lost', 'ended', 'relationship']):
                return 'intervention_relationship_loss'
            elif any(word in user_response_lower for word in ['moving', 'moved', 'new city', 'new place']):
                return 'intervention_moving'
            elif any(word in user_response_lower for word in ['anxiety', 'difficulty', 'initiating', 'maintaining']):
                return 'intervention_social_anxiety'
            else:
                return 'intervention_general_loneliness'
        
        return 'q1'  # Default fallback

    def _determine_next_script_item(self, user_data: Dict, user_response: str) -> str:
        """Determine the next script item based on user response and current state"""
        current_progress = user_data.get('script_progress', 0)
        current_branch = user_data.get('branch', 'general')
        
        # Get current script item
        if current_progress < len(self.loneliness_script):
            current_item = self.loneliness_script[current_progress]
        else:
            # If we've reached the end, check for branch-specific interventions
            if current_branch == 'relationship_loss':
                return 'intervention_relationship_loss'
            else:
                return 'intervention_general_loneliness'
        
        # Check if we're at the explore_causes_intro question and need to branch
        if current_item.get('id') == 'explore_causes_intro':
            # Check for specific loneliness causes in user response
            user_response_lower = user_response.lower()
            
            # Relationship changes
            relationship_keywords = ['breakup', 'divorce', 'separation', 'lost', 'ended', 'relationship', 'partner', 'spouse', 'ex', 'changes in relationships']
            if any(keyword in user_response_lower for keyword in relationship_keywords):
                user_data['branch'] = 'relationship_loss'
                # Find the relationship loss followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'relationship_loss_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Moving
            moving_keywords = ['moving', 'moved', 'new city', 'new place', 'relocated', 'new job', 'new college', 'new country']
            if any(keyword in user_response_lower for keyword in moving_keywords):
                user_data['branch'] = 'moving'
                # Find the moving followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'moving_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Social anxiety
            anxiety_keywords = ['social anxiety', 'anxiety', 'difficulty', 'initiating', 'maintaining', 'connections']
            if any(keyword in user_response_lower for keyword in anxiety_keywords):
                user_data['branch'] = 'social_anxiety'
                # Find the social anxiety followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'social_anxiety_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Lack of emotional intimacy
            intimacy_keywords = ['emotional intimacy', 'surrounded', 'not feeling close', 'lack of emotional intimacy']
            if any(keyword in user_response_lower for keyword in intimacy_keywords):
                user_data['branch'] = 'emotional_intimacy'
                # Find the emotional intimacy followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'emotional_intimacy_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Different life stage
            lifestage_keywords = ['different life stage', 'out of sync', 'peers', 'single', 'married', 'life stage']
            if any(keyword in user_response_lower for keyword in lifestage_keywords):
                user_data['branch'] = 'different_life_stage'
                return 'intervention_different_life_stage'
            
            # Digital disconnection
            digital_keywords = ['digital', 'online', 'internet', 'social media', 'digital disconnection']
            if any(keyword in user_response_lower for keyword in digital_keywords):
                user_data['branch'] = 'digital_disconnection'
                return 'intervention_digital_disconnection'
            
            # Unprocessed grief
            grief_keywords = ['grief', 'loss', 'mourn', 'unprocessed grief']
            if any(keyword in user_response_lower for keyword in grief_keywords):
                user_data['branch'] = 'unprocessed_grief'
                return 'intervention_unprocessed_grief'
            
            # Feeling misunderstood
            misunderstood_keywords = ['misunderstood', 'hide parts', 'feeling misunderstood']
            if any(keyword in user_response_lower for keyword in misunderstood_keywords):
                user_data['branch'] = 'feeling_misunderstood'
                return 'intervention_feeling_misunderstood'
            
            # Not feeling chosen
            chosen_keywords = ['not feeling chosen', 'reaching out', 'no one checks', 'not chosen']
            if any(keyword in user_response_lower for keyword in chosen_keywords):
                user_data['branch'] = 'not_feeling_chosen'
                return 'intervention_not_feeling_chosen'
            
            # Low self-worth
            worth_keywords = ['low self-worth', 'not interesting', 'not worthy', 'self-worth', 'self worth']
            if any(keyword in user_response_lower for keyword in worth_keywords):
                user_data['branch'] = 'low_self_worth'
                return 'intervention_low_self_worth'
        
        # Check if we're at part2_look_behind and user wants to explore causes
        if current_item.get('id') == 'part2_look_behind':
            user_response_lower = user_response.lower()
            positive_keywords = ['yes', 'sure', 'okay', 'ok', 'yeah', 'yep', 'absolutely', 'definitely']
            if any(keyword in user_response_lower for keyword in positive_keywords):
                # Find the explore_causes_intro item
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'explore_causes_intro':
                        return f"script_{i}"
        
        # Check if we've completed all follow-up questions for a specific cause
        # and need to ask about continuing with strategies
        if current_item.get('id') == 'relationship_loss_followup_continue_strategies':
            # Check if user wants to continue with strategies now
            user_response_lower = user_response.lower()
            continue_keywords = ['yes', 'continue', 'now', 'strategies', 'keep going', 'sure', 'okay', 'ok']
            if any(keyword in user_response_lower for keyword in continue_keywords):
                return 'intervention_relationship_loss'
            else:
                # User wants to come back later
                return 'session_end_relationship_loss'
        
        # Check for other follow-up completion points
        if current_item.get('id') == 'moving_followup_continue_strategies':
            user_response_lower = user_response.lower()
            continue_keywords = ['yes', 'continue', 'now', 'strategies', 'keep going', 'sure', 'okay', 'ok']
            if any(keyword in user_response_lower for keyword in continue_keywords):
                return 'intervention_moving'
            else:
                return 'session_end_moving'
        
        if current_item.get('id') == 'social_anxiety_followup_continue_strategies':
            user_response_lower = user_response.lower()
            continue_keywords = ['yes', 'continue', 'now', 'strategies', 'keep going', 'sure', 'okay', 'ok']
            if any(keyword in user_response_lower for keyword in continue_keywords):
                return 'intervention_social_anxiety'
            else:
                return 'session_end_social_anxiety'
        
        if current_item.get('id') == 'emotional_intimacy_followup_continue_strategies':
            user_response_lower = user_response.lower()
            continue_keywords = ['yes', 'continue', 'now', 'strategies', 'keep going', 'sure', 'okay', 'ok']
            if any(keyword in user_response_lower for keyword in continue_keywords):
                return 'intervention_emotional_intimacy'
            else:
                return 'session_end_emotional_intimacy'
        
        # Move to next script item
        next_progress = current_progress + 1
        if next_progress < len(self.loneliness_script):
            return f"script_{next_progress}"
        else:
            # End of script, check for interventions
            if current_branch == 'relationship_loss':
                return 'intervention_relationship_loss'
            else:
                return 'intervention_general_loneliness'

    def _get_intervention_response(self, intervention_type: str) -> str:
        """Get the initial response for an intervention"""
        if intervention_type in self.interventions:
            intervention = self.interventions[intervention_type]
            if 'intervention_stages' in intervention and len(intervention['intervention_stages']) > 0:
                return intervention['intervention_stages'][0]['prompt']
        return f"I understand you're dealing with {intervention_type.replace('_', ' ')}. Let's work through this together."

    def _get_next_intervention_stage(self, user_data: Dict, user_message: str) -> Optional[Dict]:
        """Get the next stage of an intervention"""
        intervention_type = user_data.get('intervention_type')
        if not intervention_type or intervention_type not in self.interventions:
            return None
        
        intervention = self.interventions[intervention_type]
        if 'intervention_stages' not in intervention:
            return None
        
        current_stage_index = user_data.get('intervention_stage_index', 0)
        stages = intervention['intervention_stages']
        
        if current_stage_index + 1 < len(stages):
            return stages[current_stage_index + 1]
        
        return None

    def _check_for_action_items(self, user_data: Dict, current_item: Dict) -> List[Dict]:
        """Check if current item should create action items"""
        action_items = []
        if 'action_items' in current_item:
            for action_item in current_item['action_items']:
                action_items.append({
                    'id': f"action_{len(user_data.get('action_items', [])) + 1}",
                    'title': action_item['title'],
                    'description': action_item['description'],
                    'due_date': self._calculate_due_date(action_item.get('reminder_after', '1 day')),
                    'completed': False,
                    'created_at': datetime.datetime.now().isoformat()
                })
        return action_items

    def _calculate_due_date(self, reminder_after: str) -> str:
        """Calculate due date based on reminder_after string"""
        now = datetime.datetime.now()
        if 'day' in reminder_after:
            days = int(reminder_after.split()[0])
            return (now + datetime.timedelta(days=days)).isoformat()
        elif 'hour' in reminder_after:
            hours = int(reminder_after.split()[0])
            return (now + datetime.timedelta(hours=hours)).isoformat()
        else:
            return (now + datetime.timedelta(days=1)).isoformat()

    def _update_action_items(self, user_data: Dict, action_items: List[Dict]):
        """Update user data with new action items"""
        if 'action_items' not in user_data:
            user_data['action_items'] = []
        user_data['action_items'].extend(action_items)

    def build_system_prompt(self, user_data: Dict) -> str:
        """Build system prompt for AI enhancement"""
        context = f"User: {user_data.get('phone_number', 'Unknown')}\n"
        context += f"Current stage: {user_data.get('current_stage', 'screening')}\n"
        context += f"Current question: {user_data.get('current_question', 'q1')}\n"
        context += f"Branch: {user_data.get('branch', 'none')}\n"
        context += f"Script progress: {user_data.get('script_progress', 0)}\n"
        
        if 'conversation_history' in user_data:
            context += "\nRecent conversation:\n"
            for entry in user_data['conversation_history'][-5:]:  # Last 5 exchanges
                context += f"Coach: {entry.get('coach_message', '')}\n"
                context += f"User: {entry.get('user_message', '')}\n"
        
        return f"""You are Niyasaathi, a compassionate loneliness coach. Your role is to provide empathetic, supportive responses while following a structured conversation flow.

Context:
{context}

Guidelines:
- Be warm, empathetic, and supportive
- Follow the provided script prompts closely
- Only enhance responses gently, don't change the core message
- Maintain appropriate boundaries
- Never provide medical advice
- Focus on actionable, practical suggestions
- Use the user's preferred name when available
- Keep responses conversational and natural"""

    def process_message(self, user_data: Dict, user_message: str) -> Dict:
        """Process user message and return appropriate response"""
        try:
            if 'conversation_history' not in user_data:
                user_data['conversation_history'] = []

            # Add current exchange to history
            user_data['conversation_history'].append({
                'timestamp': datetime.datetime.now().isoformat(),
                'coach_message': user_data.get('last_coach_message', ''),
                'user_message': user_message
            })

            # Track user preferred name
            if 'user_preferred_name' not in user_data:
                user_data['user_preferred_name'] = None

            response = ''
            action_items = []

            # Always use the first introduction prompt as the very first message
            if len(user_data['conversation_history']) == 1:
                response = self.loneliness_script[0]['prompt']
                user_data['script_progress'] = 0
                user_data['current_stage'] = 'loneliness_script'
            # Ask for preferred name after the first prompt
            elif user_data['user_preferred_name'] is None and user_data.get('script_progress', 0) == 0:
                response = "Before we continue, how would you like me to address you? (You can share a name or nickname, or just say 'no preference'.)"
                user_data['script_progress'] = 1
                user_data['current_stage'] = 'loneliness_script'
            elif user_data['user_preferred_name'] is None and user_data.get('script_progress', 0) == 1:
                # Save the preferred name if provided
                if user_message.strip().lower() not in ['no preference', 'no', 'none', '']:
                    user_data['user_preferred_name'] = user_message.strip()
                response = self.loneliness_script[1]['prompt']
                user_data['script_progress'] = 2
                user_data['current_stage'] = 'loneliness_script'
            else:
                current_stage = user_data.get('current_stage', 'screening')
                action_items = []
                if current_stage == 'loneliness_script':
                    next_item_id = self._determine_next_script_item(user_data, user_message)
                    if next_item_id.startswith('intervention_'):
                        intervention_type = next_item_id.replace('intervention_', '')
                        response = self._get_intervention_response(intervention_type)
                        user_data['current_stage'] = 'intervention'
                        user_data['intervention_type'] = intervention_type
                        user_data['intervention_stage_index'] = 0
                    elif next_item_id.startswith('script_'):
                        script_progress = int(next_item_id.replace('script_', ''))
                        current_item = self.loneliness_script[script_progress]
                        # Strictly use the JSON prompt, only build gently if needed
                        response = current_item.get('prompt', 'How are you feeling?')
                        user_data['script_progress'] = script_progress
                        user_data['current_stage'] = 'loneliness_script'
                        action_items = self._check_for_action_items(user_data, current_item)
                    else:
                        response = "Thank you for sharing that with me. How are you feeling right now?"
                elif current_stage == 'intervention':
                    # Handle multi-stage intervention flow
                    next_stage = self._get_next_intervention_stage(user_data, user_message)
                    if next_stage:
                        response = next_stage['prompt']
                        user_data['intervention_stage_index'] = user_data.get('intervention_stage_index', 0) + 1
                        
                        # Check if this is the last stage
                        intervention_type = user_data.get('intervention_type')
                        if intervention_type in self.interventions:
                            intervention = self.interventions[intervention_type]
                            if 'intervention_stages' in intervention:
                                stages = intervention['intervention_stages']
                                if user_data['intervention_stage_index'] >= len(stages):
                                    # End of intervention, provide closing message
                                    response = "Thank you for working through this with me. I will check with you on the follow-ups till we connect again. When do you want to connect again?"
                                    user_data['current_stage'] = 'intervention_complete'
                                    user_data['intervention_type'] = None
                                    user_data['intervention_stage_index'] = 0
                    else:
                        # End of intervention or error, provide closing message
                        response = "Thank you for working through this with me. I will check with you on the follow-ups till we connect again. When do you want to connect again?"
                        user_data['current_stage'] = 'intervention_complete'
                        user_data['intervention_type'] = None
                        user_data['intervention_stage_index'] = 0
                elif current_stage == 'intervention_complete':
                    # Handle response after intervention completion
                    response = "Perfect! I'll be here when you're ready to connect again. Take care and remember, you're not alone in this journey."
                    user_data['current_stage'] = 'general'
                else:
                    next_question_id = self._determine_next_question(user_data, user_message)
                    if next_question_id.startswith('intervention_'):
                        intervention_type = next_question_id.replace('intervention_', '')
                        response = self._get_intervention_response(intervention_type)
                        user_data['current_stage'] = 'intervention'
                        user_data['intervention_type'] = intervention_type
                    else:
                        next_question = self.find_question_by_id(next_question_id)
                        if next_question:
                            response = next_question['question']
                            user_data['current_question'] = next_question_id
                            user_data['current_stage'] = next_question.get('branch', 'general')
                            if next_question.get('branch'):
                                user_data['branch'] = next_question['branch']
                        else:
                            response = "Thank you for sharing that with me. How are you feeling right now?"
                if action_items:
                    self._update_action_items(user_data, action_items)
                # Add user's preferred name occasionally (every 3rd message after set)
                if user_data['user_preferred_name'] and user_data.get('script_progress', 0) % 3 == 0:
                    response = f"{user_data['user_preferred_name']}, {response}"

            # AI enhancement (skip for interventions)
            enhanced_response = response
            if user_data.get('current_stage') not in ['intervention', 'intervention_complete']:
                system_prompt = self.build_system_prompt(user_data)
                ai_response = self.openai_client.chat.completions.create(
                    model='gpt-4',
                    messages=[
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': f'User said: {user_message}\n\nCoach should respond with: {response}\n\nStrictly use the provided script prompt as the main message. Do not add \'dear\', \'my dear\', or similar terms. Only build gently on the script prompt if needed. Only branch to intervention if keywords are detected.'}
                    ],
                    max_tokens=300,
                    temperature=0.7
                )
                enhanced_response = ai_response.choices[0].message.content

            user_data['last_coach_message'] = enhanced_response
            user_data['last_updated'] = datetime.datetime.now().isoformat()

            return {
                'response': enhanced_response,
                'next_question_id': user_data.get('current_question', ''),
                'current_stage': user_data.get('current_stage'),
                'branch': user_data.get('branch'),
                'intervention_type': user_data.get('intervention_type'),
                'script_progress': user_data.get('script_progress'),
                'action_items': action_items,
                'user_data': user_data
            }

        except Exception as error:
            print(f'Error in AI agent: {error}')
            return {
                'response': "I'm here with you. Can you tell me a bit more about what you're experiencing?",
                'next_question_id': user_data.get('current_question', 'q1'),
                'current_stage': user_data.get('current_stage', 'screening'),
                'branch': user_data.get('branch'),
                'intervention_type': None,
                'script_progress': user_data.get('script_progress', 0),
                'action_items': [],
                'user_data': user_data
            }

# Initialize AI Agent - moved to function level to avoid import errors
ai_agent = None

def get_ai_agent():
    """Get or initialize the AI agent"""
    global ai_agent
    if ai_agent is None:
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if openai_api_key:
            try:
                print(f'Initializing AI Agent with OpenAI API key: {openai_api_key[:10]}...')
                ai_agent = NIYAsaathiAgent(openai_api_key)
                print('✅ AI Agent initialized successfully')
            except Exception as error:
                print(f'AI Agent initialization error: {error}')
                import traceback
                traceback.print_exc()
                ai_agent = None
        else:
            print('Warning: OPENAI_API_KEY not found. AI features will be limited.')
    return ai_agent

# Utility functions
def generate_token(phone_number: str) -> str:
    """Generate JWT token for user"""
    payload = {
        'phone_number': phone_number,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    return jwt.encode(payload, os.environ.get('JWT_SECRET', 'default-secret'), algorithm='HS256')

def verify_token(token: str) -> Optional[str]:
    """Verify JWT token and return phone number"""
    try:
        payload = jwt.decode(token, os.environ.get('JWT_SECRET', 'default-secret'), algorithms=['HS256'])
        return payload.get('phone_number')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))

def get_user_data(phone_number: str) -> Dict:
    """Get user data from Firestore"""
    try:
        doc_ref = db.collection('users').document(phone_number)
        doc = doc_ref.get()
        if doc.exists:
            user_data = doc.to_dict()
            # Ensure last_coach_message field exists
            if 'last_coach_message' not in user_data:
                user_data['last_coach_message'] = None
            return user_data
        else:
            return {
                'phone_number': phone_number,
                'created_at': datetime.datetime.now().isoformat(),
                'conversation_history': [],
                'current_stage': 'screening',
                'current_question': 'q1',
                'script_progress': 0,
                'last_coach_message': None
            }
    except Exception as error:
        print(f'Error getting user data: {error}')
        return {
            'phone_number': phone_number,
            'created_at': datetime.datetime.now().isoformat(),
            'conversation_history': [],
            'current_stage': 'screening',
            'current_question': 'q1',
            'script_progress': 0,
            'last_coach_message': None
        }

def save_user_data(phone_number: str, user_data: Dict):
    """Save user data to Firestore"""
    try:
        doc_ref = db.collection('users').document(phone_number)
        doc_ref.set(user_data)
        print(f'User data saved for {phone_number}')
    except Exception as error:
        print(f'Error saving user data: {error}')

# Flask routes
@app.route('/handle-message', methods=['POST'])
def handle_message():
    """Handle incoming chat messages"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        token = data.get('token')
        message = data.get('message')
        
        if not token or not message:
            return jsonify({'error': 'Missing token or message'}), 400
        
        phone_number = verify_token(token)
        if not phone_number:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_data = get_user_data(phone_number)
        
        ai_agent = get_ai_agent() # Get AI agent here
        if not ai_agent:
            return jsonify({'error': 'AI agent not available'}), 500
        
        result = ai_agent.process_message(user_data, message)
        
        # Save updated user data
        save_user_data(phone_number, result['user_data'])
        
        return jsonify({
            'response': result['response'],
            'user_data': result['user_data'],
            'next_question_id': result['next_question_id'],
            'current_stage': result['current_stage'],
            'branch': result['branch'],
            'intervention_type': result['intervention_type'],
            'script_progress': result['script_progress'],
            'action_items': result['action_items']
        })
        
    except Exception as error:
        print(f'Error in handle_message: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/speak', methods=['POST'])
def speak():
    """Google Cloud TTS endpoint"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
        
        text = data['text']
        if len(text) > 5000:
            return jsonify({'error': 'Text too long'}), 400
        
        # Initialize Google Cloud TTS client
        client = texttospeech.TextToSpeechClient()
        
        # Remove all SSML and chunk at sentence boundaries for smooth audio
        sentences = re.findall(r'[^.!?]+[.!?]+', text) or [text]
        chunks = []
        current_chunk = ''
        
        for sentence in sentences:
            if len(current_chunk + sentence) > 4500:  # stay under 5000 char limit
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
            else:
                current_chunk += sentence
        
        if current_chunk:
            chunks.append(current_chunk)
        
        if not chunks:
            chunks = [text]
        
        print(f'Processing {len(chunks)} text chunks')
        
        audio_buffers = []
        for chunk in chunks:
            request_obj = texttospeech.SynthesisInput(text=chunk)
            voice = texttospeech.VoiceSelectionParams(
                language_code='en-IN',
                name='en-IN-Chirp3-HD-Gacrux'
            )
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                speaking_rate=0.81
            )
            
            response = client.synthesize_speech(
                input=request_obj,
                voice=voice,
                audio_config=audio_config
            )
            
            if not response.audio_content:
                raise Exception('No audio content received from Google TTS')
            
            audio_buffers.append(response.audio_content)
        
        # Concatenate audio buffers
        final_audio = b''.join(audio_buffers)
        
        return Response(
            final_audio,
            status=200,
            headers={
                'Content-Type': 'audio/wav',
                'Content-Disposition': 'inline; filename="response.wav"'
            }
        )
        
    except Exception as error:
        print(f'Google TTS error: {error}')
        return jsonify({'error': f'Speech synthesis failed: {str(error)}'}), 500

@app.route('/send-verification-code', methods=['POST'])
def send_verification_code():
    """Send verification code via SMS"""
    try:
        data = request.get_json()
        if not data or 'phone_number' not in data:
            return jsonify({'error': 'No phone number provided'}), 400
        
        phone_number = data['phone_number']
        verification_code = generate_verification_code()
        
        # Store verification code in Firestore
        doc_ref = db.collection('verification_codes').document(phone_number)
        doc_ref.set({
            'code': verification_code,
            'created_at': datetime.datetime.now().isoformat(),
            'expires_at': (datetime.datetime.now() + datetime.timedelta(minutes=10)).isoformat()
        })
        
        # For now, just log the code (replace with actual SMS sending)
        print(f'Verification code for {phone_number}: {verification_code}')
        
        return jsonify({'message': 'Verification code sent'})
        
    except Exception as error:
        print(f'Error sending verification code: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/verify-code', methods=['POST'])
def verify_code():
    """Verify the code and return JWT token"""
    try:
        data = request.get_json()
        if not data or 'phone_number' not in data or 'code' not in data:
            return jsonify({'error': 'Missing phone number or code'}), 400
        
        phone_number = data['phone_number']
        code = data['code']
        
        # Get stored verification code
        doc_ref = db.collection('verification_codes').document(phone_number)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({'error': 'Invalid verification code'}), 400
        
        stored_data = doc.to_dict()
        stored_code = stored_data.get('code')
        expires_at = datetime.datetime.fromisoformat(stored_data.get('expires_at'))
        
        if datetime.datetime.now() > expires_at:
            return jsonify({'error': 'Verification code expired'}), 400
        
        if code != stored_code:
            return jsonify({'error': 'Invalid verification code'}), 400
        
        # Delete the verification code
        doc_ref.delete()
        
        # Generate JWT token
        token = generate_token(phone_number)
        
        # Get or create user data
        user_data = get_user_data(phone_number)
        
        return jsonify({
            'token': token,
            'user': {
                'id': f'user_{phone_number}',
                'phone_number': phone_number,
                'created_at': user_data.get('created_at'),
                'last_login': datetime.datetime.now().isoformat()
            }
        })
        
    except Exception as error:
        print(f'Error verifying code: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/get-user-data', methods=['POST'])
def get_user_data_endpoint():
    """Get user data"""
    try:
        data = request.get_json()
        if not data or 'token' not in data:
            return jsonify({'error': 'No token provided'}), 400
        
        token = data['token']
        phone_number = verify_token(token)
        
        if not phone_number:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_data = get_user_data(phone_number)
        
        return jsonify(user_data)
        
    except Exception as error:
        print(f'Error getting user data: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    ai_agent = get_ai_agent() # Get AI agent here
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.datetime.now().isoformat(),
        'ai_agent_available': ai_agent is not None
    })

# Main function for Google Cloud Functions
def niyasaathi_api(request):
    """Main function for Google Cloud Functions"""
    # Set up the request context for Flask
    with app.request_context(request.environ):
        # Handle the request through Flask
        return app.full_dispatch_request()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080))) 
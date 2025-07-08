import json
import openai
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class NIYAsaathiAgent:
    def __init__(self, openai_api_key: str):
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.questions = self._load_questions()
        self.interventions = self._load_interventions()
        self.loneliness_script = self._load_loneliness_script()
        
    def _load_questions(self) -> Dict:
        """Load the question bank from JSON file"""
        # Try multiple possible paths
        possible_paths = [
            'agent/questions.json',
            '../agent/questions.json',
            'questions.json'
        ]
        
        for path in possible_paths:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except FileNotFoundError:
                continue
        
        # If all paths fail, return empty dict
        print(f"Warning: Could not find questions.json in any of these paths: {possible_paths}")
        return {}
    
    def _load_interventions(self) -> Dict:
        """Load intervention scripts from JSON file"""
        # Try multiple possible paths
        possible_paths = [
            'agent/interventions.json',
            '../agent/interventions.json',
            'interventions.json'
        ]
        
        for path in possible_paths:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except FileNotFoundError:
                continue
        
        # If all paths fail, return empty dict
        print(f"Warning: Could not find interventions.json in any of these paths: {possible_paths}")
        return {}
    
    def _load_loneliness_script(self) -> List[Dict]:
        """Load the loneliness script from JSON file"""
        # Try multiple possible paths
        possible_paths = [
            'agent/loneliness_script.json',
            '../agent/loneliness_script.json',
            'loneliness_script.json'
        ]
        
        for path in possible_paths:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except FileNotFoundError:
                continue
        
        # If all paths fail, return empty list
        print(f"Warning: Could not find loneliness_script.json in any of these paths: {possible_paths}")
        return []
    
    def _find_question_by_id(self, question_id: str) -> Optional[Dict]:
        """Find a question by its ID across all sections"""
        for section in self.questions.values():
            if question_id in section:
                return section[question_id]
        return None
    
    def _find_script_item_by_id(self, item_id: str) -> Optional[Dict]:
        """Find a script item by its ID"""
        for item in self.loneliness_script:
            if item.get('id') == item_id:
                return item
        return None
    
    def _get_user_context(self, user_data: Dict) -> str:
        """Build context from user's conversation history"""
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
        
        return context
    
    def _build_system_prompt(self, user_data: Dict) -> str:
        """Build the system prompt for OpenAI API"""
        base_prompt = """You are Niyasaathi, an empathetic loneliness coach by Niya. You sound like a gentle Indian therapist or life coach.

Your core principles:
1. Always maintain a warm, supportive, and validating tone
2. Never dismiss or minimize user's feelings
3. Be direct about recommending professional help when needed
4. Focus on actionable, practical suggestions
5. Maintain appropriate boundaries
6. Never provide medical advice

Your conversation style:
- Kind, validating, and soft
- Don't rush - let users speak and feel heard
- Probe gently and only if the user is ready
- Use the structured conversation flow provided
- Remember past interactions and continue from where you left off

IMPORTANT:
- When asking questions or giving prompts, use the exact wording from the provided script (JSON) whenever possible, or build directly on it. Do not paraphrase or reword unless necessary for clarity.
- Avoid over-apologizing or saying 'I'm sorry' for every user response. Instead, validate and gently encourage the user to share more.
- Only add empathy or transitions if the script does not already include them.

Current conversation context:
{context}

Your response should:
1. Use the exact script prompt for the next step, or build on it with gentle, validating language.
2. Avoid excessive apologies; focus on validation and curiosity.
3. If the user has completed a section, provide appropriate intervention guidance.
4. Keep responses conversational and warm.
5. If the user seems to need immediate professional help, gently suggest it.

Remember: You are Niyasaathi, not Niva. Use this name consistently."""
        
        return base_prompt.format(context=self._get_user_context(user_data))
    
    def _determine_next_question(self, user_data: Dict, user_response: str) -> str:
        """Determine the next question based on user response and current state"""
        current_question_id = user_data.get('current_question', 'q1')
        current_question = self._find_question_by_id(current_question_id)
        
        if not current_question:
            return 'q1'
        
        # Check if user response indicates a specific branch
        if current_question.get('type') == 'yes_no':
            if any(word in user_response.lower() for word in ['yes', 'yeah', 'yep', 'sure', 'okay']):
                if current_question.get('branch'):
                    return current_question.get('next', 'q2')
                else:
                    return current_question.get('next', 'q2')
            else:
                # If no to social anxiety question, move to general intervention
                if current_question_id == 'q10':
                    return 'intervention_general_loneliness'
                else:
                    return current_question.get('next', 'q2')
        
        # For open-ended questions, move to next question
        return current_question.get('next', 'q2')
    
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
            relationship_keywords = ['breakup', 'divorce', 'separation', 'lost', 'ended', 'relationship', 'partner', 'spouse', 'ex', '1', 'one', 'first']
            if any(keyword in user_response_lower for keyword in relationship_keywords):
                user_data['branch'] = 'relationship_loss'
                # Find the relationship loss followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'relationship_loss_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Moving
            moving_keywords = ['moving', 'moved', 'new city', 'new place', 'relocated', '2', 'two', 'second']
            if any(keyword in user_response_lower for keyword in moving_keywords):
                user_data['branch'] = 'moving'
                # Find the moving followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'moving_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Social anxiety
            anxiety_keywords = ['social anxiety', 'anxiety', 'difficulty', 'initiating', 'maintaining', 'connections', '3', 'three', 'third']
            if any(keyword in user_response_lower for keyword in anxiety_keywords):
                user_data['branch'] = 'social_anxiety'
                # Find the social anxiety followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'social_anxiety_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Lack of emotional intimacy
            intimacy_keywords = ['emotional intimacy', 'surrounded', 'not feeling close', '4', 'four', 'fourth']
            if any(keyword in user_response_lower for keyword in intimacy_keywords):
                user_data['branch'] = 'emotional_intimacy'
                # Find the emotional intimacy followup intro
                for i, item in enumerate(self.loneliness_script):
                    if item.get('id') == 'emotional_intimacy_followup_intro':
                        user_data['script_progress'] = i
                        return f"script_{i}"
            
            # Different life stage
            lifestage_keywords = ['different life stage', 'out of sync', 'peers', 'single', 'married', '5', 'five', 'fifth']
            if any(keyword in user_response_lower for keyword in lifestage_keywords):
                user_data['branch'] = 'different_life_stage'
                return 'intervention_different_life_stage'
            
            # Digital disconnection
            digital_keywords = ['digital', 'online', 'internet', 'social media', '6', 'six', 'sixth']
            if any(keyword in user_response_lower for keyword in digital_keywords):
                user_data['branch'] = 'digital_disconnection'
                return 'intervention_digital_disconnection'
            
            # Unprocessed grief
            grief_keywords = ['grief', 'loss', 'mourn', '7', 'seven', 'seventh']
            if any(keyword in user_response_lower for keyword in grief_keywords):
                user_data['branch'] = 'unprocessed_grief'
                return 'intervention_unprocessed_grief'
            
            # Feeling misunderstood
            misunderstood_keywords = ['misunderstood', 'hide parts', '8', 'eight', 'eighth']
            if any(keyword in user_response_lower for keyword in misunderstood_keywords):
                user_data['branch'] = 'feeling_misunderstood'
                return 'intervention_feeling_misunderstood'
            
            # Not feeling chosen
            chosen_keywords = ['not feeling chosen', 'reaching out', 'no one checks', '9', 'nine', 'ninth']
            if any(keyword in user_response_lower for keyword in chosen_keywords):
                user_data['branch'] = 'not_feeling_chosen'
                return 'intervention_not_feeling_chosen'
            
            # Low self-worth
            worth_keywords = ['low self-worth', 'not interesting', 'not worthy', '10', 'ten', 'tenth']
            if any(keyword in user_response_lower for keyword in worth_keywords):
                user_data['branch'] = 'low_self_worth'
                return 'intervention_low_self_worth'
        
        # Check for branch triggers in user response (existing logic)
        if current_branch == 'general':
            # Look for relationship-related keywords
            relationship_keywords = ['breakup', 'divorce', 'separation', 'lost', 'ended', 'relationship', 'partner', 'spouse', 'ex']
            if any(keyword in user_response.lower() for keyword in relationship_keywords):
                user_data['branch'] = 'relationship_loss'
                return 'intervention_relationship_loss'
        
        # Move to next script item
        next_progress = current_progress + 1
        if next_progress < len(self.loneliness_script):
            # Check if we're at the end of a follow-up section
            current_item = self.loneliness_script[current_progress]
            current_section = current_item.get('section', '')
            
            # Check if we've reached the end of a follow-up section
            if current_section.startswith('Follow-up:'):
                # Check if the next item is not in the same follow-up section
                if next_progress < len(self.loneliness_script):
                    next_item = self.loneliness_script[next_progress]
                    next_section = next_item.get('section', '')
                    
                    # If we're moving to a different section, transition to intervention
                    if not next_section.startswith('Follow-up:'):
                        # Map current branch to appropriate intervention
                        if current_branch == 'relationship_loss':
                            return 'intervention_relationship_loss'
                        elif current_branch == 'moving':
                            return 'intervention_moving'
                        elif current_branch == 'social_anxiety':
                            return 'intervention_social_anxiety'
                        elif current_branch == 'emotional_intimacy':
                            return 'intervention_emotional_intimacy'
                        elif current_branch == 'different_life_stage':
                            return 'intervention_different_life_stage'
                        elif current_branch == 'digital_disconnection':
                            return 'intervention_digital_disconnection'
                        elif current_branch == 'unprocessed_grief':
                            return 'intervention_unprocessed_grief'
                        elif current_branch == 'feeling_misunderstood':
                            return 'intervention_feeling_misunderstood'
                        elif current_branch == 'not_feeling_chosen':
                            return 'intervention_not_feeling_chosen'
                        elif current_branch == 'low_self_worth':
                            return 'intervention_low_self_worth'
                        else:
                            return 'intervention_general_loneliness'
            
            return f"script_{next_progress}"
        else:
            # End of script, move to appropriate intervention
            if current_branch == 'relationship_loss':
                return 'intervention_relationship_loss'
            elif current_branch == 'moving':
                return 'intervention_moving'
            elif current_branch == 'social_anxiety':
                return 'intervention_social_anxiety'
            elif current_branch == 'emotional_intimacy':
                return 'intervention_emotional_intimacy'
            elif current_branch == 'different_life_stage':
                return 'intervention_different_life_stage'
            elif current_branch == 'digital_disconnection':
                return 'intervention_digital_disconnection'
            elif current_branch == 'unprocessed_grief':
                return 'intervention_unprocessed_grief'
            elif current_branch == 'feeling_misunderstood':
                return 'intervention_feeling_misunderstood'
            elif current_branch == 'not_feeling_chosen':
                return 'intervention_not_feeling_chosen'
            elif current_branch == 'low_self_worth':
                return 'intervention_low_self_worth'
            else:
                return 'intervention_general_loneliness'
    
    def _get_intervention_response(self, intervention_type: str) -> str:
        """Get appropriate intervention response"""
        if intervention_type not in self.interventions:
            intervention_type = 'general_loneliness'
        
        intervention = self.interventions[intervention_type]
        
        response = f"{intervention.get('title', 'Support')}\n\n"
        response += f"{intervention.get('message', intervention.get('description', ''))}\n\n"
        
        response += "Here are some gentle suggestions that might help:\n\n"
        for i, suggestion in enumerate(intervention.get('suggestions', []), 1):
            response += f"{i}. {suggestion['title']}: {suggestion['description']}\n"
            response += f"   Action: {suggestion['action']}\n\n"
        
        response += f"\n{intervention.get('follow_up', 'How are you feeling about these suggestions?')}"
        
        return response
    
    def _get_script_response(self, script_progress: int) -> str:
        """Get response from loneliness script"""
        if script_progress >= len(self.loneliness_script):
            return "Thank you for sharing that with me. How are you feeling right now?"
        
        script_item = self.loneliness_script[script_progress]
        return script_item.get('prompt', 'How are you feeling?')
    
    def _check_for_action_items(self, user_data: Dict, current_item: Dict) -> List[Dict]:
        """Check if current interaction has action items that need nudges"""
        action_items = []
        
        if current_item.get('action_item', False):
            # Create action item for nudge system
            action_item = {
                'id': current_item.get('id'),
                'type': 'reflection' if 'reflection' in current_item.get('id', '') else 'exercise',
                'description': current_item.get('prompt', ''),
                'created_at': datetime.now().isoformat(),
                'due_date': (datetime.now() + timedelta(days=1)).isoformat(),  # Default to 1 day
                'completed': False,
                'reminder_sent': False
            }
            action_items.append(action_item)
        
        return action_items
    
    def _update_action_items(self, user_data: Dict, action_items: List[Dict]):
        """Update user's action items list"""
        if 'action_items' not in user_data:
            user_data['action_items'] = []
        
        user_data['action_items'].extend(action_items)
    
    def process_message(self, user_data: Dict, user_message: str) -> Dict:
        """Process user message and return appropriate response"""
        try:
            if 'conversation_history' not in user_data:
                user_data['conversation_history'] = []

            # Add current exchange to history
            user_data['conversation_history'].append({
                'timestamp': datetime.now().isoformat(),
                'coach_message': user_data.get('last_coach_message', ''),
                'user_message': user_message
            })

            # Track user preferred name
            if 'user_preferred_name' not in user_data:
                user_data['user_preferred_name'] = None

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
                else:
                    next_question_id = self._determine_next_question(user_data, user_message)
                    if next_question_id.startswith('intervention_'):
                        intervention_type = next_question_id.replace('intervention_', '')
                        response = self._get_intervention_response(intervention_type)
                        user_data['current_stage'] = 'intervention'
                        user_data['intervention_type'] = intervention_type
                    else:
                        next_question = self._find_question_by_id(next_question_id)
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
            # Generate AI-enhanced response (but strictly use the script prompt as main message)
            system_prompt = self._build_system_prompt(user_data)
            ai_response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"User said: {user_message}\n\nCoach should respond with: {response}\n\nStrictly use the provided script prompt as the main message. Do not add 'dear', 'my dear', or similar terms. Only build gently on the script prompt if needed. Only branch to intervention if keywords are detected."}
                ],
                max_tokens=300,
                temperature=0.7
            )
            enhanced_response = ai_response.choices[0].message.content
            user_data['last_coach_message'] = enhanced_response
            user_data['last_updated'] = datetime.now().isoformat()
            return {
                'response': enhanced_response,
                'next_question_id': user_data.get('current_question', ''),
                'current_stage': user_data.get('current_stage'),
                'branch': user_data.get('branch'),
                'intervention_type': user_data.get('intervention_type'),
                'script_progress': user_data.get('script_progress'),
                'action_items': action_items if 'action_items' in locals() else [],
                'user_data': user_data
            }
        except Exception as e:
            print(f"Error in AI agent: {e}")
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
    
    def get_follow_up_message(self, user_data: Dict) -> str:
        """Generate a follow-up message for nudges"""
        intervention_type = user_data.get('intervention_type', 'general_loneliness')
        intervention = self.interventions.get(intervention_type, self.interventions['general_loneliness'])
        
        return intervention.get('follow_up', "How are you feeling today? Remember, I'm here to support you.")
    
    def get_action_item_reminders(self, user_data: Dict) -> List[Dict]:
        """Get pending action item reminders for nudges"""
        if 'action_items' not in user_data:
            return []
        
        current_time = datetime.now()
        reminders = []
        
        for item in user_data['action_items']:
            if not item.get('completed', False) and not item.get('reminder_sent', False):
                due_date = datetime.fromisoformat(item['due_date'])
                if current_time >= due_date:
                    reminders.append({
                        'id': item['id'],
                        'type': item['type'],
                        'message': f"Hi there! I wanted to gently remind you about the {item['type']} we discussed. {item['description']}",
                        'action_item': item
                    })
        
        return reminders
    
    def mark_action_item_completed(self, user_data: Dict, action_item_id: str):
        """Mark an action item as completed"""
        if 'action_items' not in user_data:
            return
        
        for item in user_data['action_items']:
            if item.get('id') == action_item_id:
                item['completed'] = True
                item['completed_at'] = datetime.now().isoformat()
                break
    
    def start_loneliness_script(self, user_data: Dict) -> Dict:
        """Start the loneliness script conversation flow"""
        user_data['current_stage'] = 'loneliness_script'
        user_data['script_progress'] = 0
        user_data['branch'] = 'general'
        
        if self.loneliness_script:
            first_item = self.loneliness_script[0]
            response = first_item.get('prompt', 'Hi there. How are you feeling today?')
            
            # Check for action items
            action_items = self._check_for_action_items(user_data, first_item)
            if action_items:
                self._update_action_items(user_data, action_items)
            
            return {
                'response': response,
                'current_stage': 'loneliness_script',
                'script_progress': 0,
                'branch': 'general',
                'action_items': action_items,
                'user_data': user_data
            }
        else:
            return {
                'response': "Hi there. How are you feeling today?",
                'current_stage': 'loneliness_script',
                'script_progress': 0,
                'branch': 'general',
                'action_items': [],
                'user_data': user_data
            } 
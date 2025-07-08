import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class NudgeSystem:
    def __init__(self):
        self.nudge_templates = {
            'reflection': {
                'title': 'Gentle Reminder',
                'message': 'Hi there! I wanted to gently remind you about the reflection exercise we discussed. {description}',
                'timing': 24  # hours
            },
            'exercise': {
                'title': 'Time for Your Practice',
                'message': 'Hello! It might be a good time to try that exercise we talked about. {description}',
                'timing': 48  # hours
            },
            'journal': {
                'title': 'Daily Reflection',
                'message': 'Good morning! Here\'s your gentle reminder for today\'s reflection: {description}',
                'timing': 24  # hours
            }
        }
    
    def check_pending_nudges(self, user_data: Dict) -> List[Dict]:
        """Check for pending nudges that need to be sent"""
        if 'action_items' not in user_data:
            return []
        
        current_time = datetime.now()
        pending_nudges = []
        
        for item in user_data['action_items']:
            if not item.get('completed', False) and not item.get('reminder_sent', False):
                due_date = datetime.fromisoformat(item['due_date'])
                if current_time >= due_date:
                    nudge = self._create_nudge(item)
                    if nudge:
                        pending_nudges.append(nudge)
        
        return pending_nudges
    
    def _create_nudge(self, action_item: Dict) -> Optional[Dict]:
        """Create a nudge message for an action item"""
        item_type = action_item.get('type', 'exercise')
        template = self.nudge_templates.get(item_type, self.nudge_templates['exercise'])
        
        return {
            'id': f"nudge_{action_item['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'action_item_id': action_item['id'],
            'title': template['title'],
            'message': template['message'].format(description=action_item.get('description', '')),
            'type': item_type,
            'created_at': datetime.now().isoformat(),
            'action_item': action_item
        }
    
    def mark_nudge_sent(self, user_data: Dict, action_item_id: str):
        """Mark that a nudge has been sent for an action item"""
        if 'action_items' not in user_data:
            return
        
        for item in user_data['action_items']:
            if item.get('id') == action_item_id:
                item['reminder_sent'] = True
                item['reminder_sent_at'] = datetime.now().isoformat()
                break
    
    def schedule_follow_up_nudge(self, user_data: Dict, action_item_id: str, hours: int = 24):
        """Schedule a follow-up nudge for later"""
        if 'action_items' not in user_data:
            return
        
        for item in user_data['action_items']:
            if item.get('id') == action_item_id:
                item['due_date'] = (datetime.now() + timedelta(hours=hours)).isoformat()
                item['reminder_sent'] = False
                break
    
    def get_daily_reflection_reminder(self, user_data: Dict, day_number: int) -> Optional[Dict]:
        """Get a specific daily reflection reminder"""
        reflection_questions = [
            "What's something I still carry from that relationship (good or hard)?",
            "What version of myself was most visible in that connection?",
            "What did I give in that relationship that I can also give to myself?",
            "What do I fear about forming new connections now?",
            "What would it mean to feel 'safe' in connection again?"
        ]
        
        if 1 <= day_number <= len(reflection_questions):
            return {
                'id': f"daily_reflection_{day_number}",
                'title': f"Day {day_number} Reflection",
                'message': f"Good morning! Here's your gentle reminder for today's reflection: {reflection_questions[day_number - 1]}",
                'type': 'journal',
                'day_number': day_number,
                'created_at': datetime.now().isoformat()
            }
        
        return None
    
    def create_action_item(self, item_id: str, item_type: str, description: str, 
                          due_hours: int = 24) -> Dict:
        """Create a new action item"""
        return {
            'id': item_id,
            'type': item_type,
            'description': description,
            'created_at': datetime.now().isoformat(),
            'due_date': (datetime.now() + timedelta(hours=due_hours)).isoformat(),
            'completed': False,
            'reminder_sent': False
        }
    
    def get_user_progress_summary(self, user_data: Dict) -> Dict:
        """Get a summary of user's action item progress"""
        if 'action_items' not in user_data:
            return {
                'total_items': 0,
                'completed_items': 0,
                'pending_items': 0,
                'completion_rate': 0.0
            }
        
        total_items = len(user_data['action_items'])
        completed_items = sum(1 for item in user_data['action_items'] if item.get('completed', False))
        pending_items = total_items - completed_items
        completion_rate = (completed_items / total_items * 100) if total_items > 0 else 0.0
        
        return {
            'total_items': total_items,
            'completed_items': completed_items,
            'pending_items': pending_items,
            'completion_rate': round(completion_rate, 1)
        } 
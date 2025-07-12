const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

class NIYAsaathiAgent {
    constructor(openaiApiKey) {
        this.openai = new OpenAI({
            apiKey: openaiApiKey
        });
        
        // Load conversation scripts
        this.conversationScript = this.loadConversationScript();
        this.interventions = this.loadInterventions();
        
        // Initialize conversation state
        this.conversationState = {
            current_section: 'initial_screening',
            user_data: {},
            follow_up_section: null,
            intervention_active: false,
            intervention_stage: 0,
            intervention_type: null,
            conversation_history: []
        };
    }
    
    loadConversationScript() {
        try {
            const scriptPath = path.join(__dirname, '..', '..', 'agent', 'conversation_script.json');
            const scriptData = fs.readFileSync(scriptPath, 'utf8');
            return JSON.parse(scriptData);
        } catch (error) {
            console.error('Error loading conversation script:', error);
            return {};
        }
    }
    
    loadInterventions() {
        try {
            const interventionsPath = path.join(__dirname, '..', '..', 'agent', 'interventions.json');
            const interventionsData = fs.readFileSync(interventionsPath, 'utf8');
            return JSON.parse(interventionsData);
        } catch (error) {
            console.error('Error loading interventions:', error);
            return {};
        }
    }
    
    async process_message(user_data, message) {
        try {
            // Update user data
            this.conversationState.user_data = { ...this.conversationState.user_data, ...user_data };
            
            // Add message to conversation history
            this.conversationState.conversation_history.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            });
            
            let response;
            
            if (this.conversationState.intervention_active) {
                response = await this.handle_intervention_response(message);
            } else {
                response = await this.handle_regular_conversation(message);
            }
            
            // Add response to conversation history
            this.conversationState.conversation_history.push({
                role: 'assistant',
                content: response.message,
                timestamp: new Date().toISOString()
            });
            
            return {
                message: response.message,
                user_data: this.conversationState.user_data,
                conversation_state: this.conversationState,
                should_speak: response.should_speak || false,
                intervention_data: response.intervention_data || null
            };
            
        } catch (error) {
            console.error('Error processing message:', error);
            return {
                message: "I'm sorry, I'm having trouble processing your message right now. Could you please try again?",
                user_data: this.conversationState.user_data,
                conversation_state: this.conversationState,
                should_speak: false
            };
        }
    }
    
    async handle_regular_conversation(message) {
        const currentSection = this.conversationScript[this.conversationState.current_section];
        
        if (!currentSection) {
            return {
                message: "I'm sorry, I'm having trouble with the conversation flow. Let's start over.",
                should_speak: false
            };
        }
        
        // Check if we should branch based on keywords
        const branchResult = this.check_branching(message, currentSection);
        
        if (branchResult.should_branch) {
            this.conversationState.current_section = branchResult.target_section;
            const newSection = this.conversationScript[this.conversationState.current_section];
            
            return {
                message: newSection.prompt,
                should_speak: true
            };
        }
        
        // Check if we're in follow-up and should transition to intervention
        if (this.conversationState.follow_up_section && 
            this.conversationState.current_section.includes('follow_up_')) {
            
            const followUpSection = this.conversationScript[this.conversationState.current_section];
            if (followUpSection && followUpSection.transition_to_intervention) {
                return await this.start_intervention(followUpSection.transition_to_intervention);
            }
        }
        
        // Get next question or response
        const nextQuestion = this.get_next_question(currentSection, message);
        
        if (nextQuestion) {
            this.conversationState.current_section = nextQuestion;
            const nextSection = this.conversationScript[nextQuestion];
            
            return {
                message: nextSection.prompt,
                should_speak: true
            };
        }
        
        // If no specific branching, provide a general response
        return {
            message: currentSection.prompt || "Thank you for sharing that with me. How are you feeling right now?",
            should_speak: true
        };
    }
    
    async handle_intervention_response(message) {
        const interventionType = this.conversationState.intervention_type;
        const intervention = this.interventions[interventionType];
        
        if (!intervention) {
            this.conversationState.intervention_active = false;
            return {
                message: "I'm sorry, I couldn't find the intervention. Let's continue our conversation.",
                should_speak: true
            };
        }
        
        const currentStage = intervention.stages[this.conversationState.intervention_stage];
        
        if (!currentStage) {
            // Intervention completed
            this.conversationState.intervention_active = false;
            this.conversationState.intervention_stage = 0;
            this.conversationState.intervention_type = null;
            
            return {
                message: intervention.completion_message || "Thank you for completing this exercise. How are you feeling now?",
                should_speak: true,
                intervention_data: {
                    completed: true,
                    type: interventionType
                }
            };
        }
        
        // Move to next stage
        this.conversationState.intervention_stage++;
        const nextStage = intervention.stages[this.conversationState.intervention_stage];
        
        if (nextStage) {
            return {
                message: nextStage.content,
                should_speak: true,
                intervention_data: {
                    stage: this.conversationState.intervention_stage,
                    total_stages: intervention.stages.length,
                    type: interventionType
                }
            };
        } else {
            // Intervention completed
            this.conversationState.intervention_active = false;
            this.conversationState.intervention_stage = 0;
            this.conversationState.intervention_type = null;
            
            return {
                message: intervention.completion_message || "Thank you for completing this exercise. How are you feeling now?",
                should_speak: true,
                intervention_data: {
                    completed: true,
                    type: interventionType
                }
            };
        }
    }
    
    async start_intervention(interventionType) {
        const intervention = this.interventions[interventionType];
        
        if (!intervention) {
            return {
                message: "I'm sorry, I couldn't find the intervention. Let's continue our conversation.",
                should_speak: true
            };
        }
        
        this.conversationState.intervention_active = true;
        this.conversationState.intervention_stage = 0;
        this.conversationState.intervention_type = interventionType;
        
        const firstStage = intervention.stages[0];
        
        return {
            message: firstStage.content,
            should_speak: true,
            intervention_data: {
                stage: 0,
                total_stages: intervention.stages.length,
                type: interventionType
            }
        };
    }
    
    check_branching(message, currentSection) {
        if (!currentSection.branches) {
            return { should_branch: false };
        }
        
        const lowerMessage = message.toLowerCase();
        
        for (const branch of currentSection.branches) {
            if (branch.keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
                return {
                    should_branch: true,
                    target_section: branch.target_section
                };
            }
        }
        
        return { should_branch: false };
    }
    
    get_next_question(currentSection, message) {
        // Extract loneliness type from user's response
        const lowerMessage = message.toLowerCase();
        
        if (this.conversationState.current_section === 'initial_screening') {
            // Map keywords to loneliness types
            const lonelinessTypes = {
                'relationship': 'relationship_loss',
                'breakup': 'relationship_loss',
                'divorce': 'relationship_loss',
                'death': 'relationship_loss',
                'social anxiety': 'social_anxiety',
                'anxiety': 'social_anxiety',
                'nervous': 'social_anxiety',
                'moving': 'moving',
                'relocated': 'moving',
                'new city': 'moving',
                'intimacy': 'emotional_intimacy',
                'deep connection': 'emotional_intimacy',
                'meaningful': 'emotional_intimacy',
                'life stage': 'different_life_stage',
                'age': 'different_life_stage',
                'generation': 'different_life_stage',
                'digital': 'digital_disconnection',
                'social media': 'digital_disconnection',
                'online': 'digital_disconnection',
                'grief': 'unprocessed_grief',
                'loss': 'unprocessed_grief',
                'trauma': 'unprocessed_grief'
            };
            
            for (const [keyword, type] of Object.entries(lonelinessTypes)) {
                if (lowerMessage.includes(keyword)) {
                    this.conversationState.user_data.loneliness_type = type;
                    return `follow_up_${type}`;
                }
            }
            
            // Default to general loneliness
            this.conversationState.user_data.loneliness_type = 'general_loneliness';
            return 'follow_up_general_loneliness';
        }
        
        // For follow-up sections, check if we should move to intervention
        if (this.conversationState.current_section.includes('follow_up_')) {
            const lonelinessType = this.conversationState.current_section.replace('follow_up_', '');
            this.conversationState.follow_up_section = lonelinessType;
            
            // Check if follow-up is complete and should transition to intervention
            if (currentSection.transition_to_intervention) {
                return null; // Will trigger intervention in handle_regular_conversation
            }
        }
        
        return null;
    }
    
    // Method to get user's preferred name
    get_user_name() {
        return this.conversationState.user_data.preferred_name || 'friend';
    }
    
    // Method to reset conversation state
    reset_conversation() {
        this.conversationState = {
            current_section: 'initial_screening',
            user_data: {},
            follow_up_section: null,
            intervention_active: false,
            intervention_stage: 0,
            intervention_type: null,
            conversation_history: []
        };
    }
}

module.exports = { NIYAsaathiAgent }; 
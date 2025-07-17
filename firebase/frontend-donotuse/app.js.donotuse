// NIYAsaathi Frontend Application
class NIYAsaathiApp {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.conversationHistory = [];
        this.userData = {};
        this.conversationState = {};
        this.isProcessing = false;
        
        // Firebase Functions base URL (will be set during deployment)
        this.apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5001/your-project-id/us-central1/api'
            : 'https://us-central1-your-project-id.cloudfunctions.net/api';
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.setupEventListeners();
        this.loadConversationHistory();
        this.showWelcomeMessage();
    }
    
    setupEventListeners() {
        const startJourneyBtn = document.getElementById('start-journey');
        if (startJourneyBtn) {
            startJourneyBtn.addEventListener('click', () => {
                document.getElementById('landing-screen').classList.remove('active');
                document.getElementById('auth-screen').classList.add('active');
            });
        }
        // Microphone button
        const micButton = document.getElementById('micButton');
        if (micButton) {
            micButton.addEventListener('click', () => this.toggleRecording());
        }
        
        // Send button
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendTextMessage());
        }
        
        // Text input
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendTextMessage();
                }
            });
        }
        
        // History button
        const historyButton = document.getElementById('historyButton');
        if (historyButton) {
            historyButton.addEventListener('click', () => this.toggleHistoryModal());
        }
        
        // Close history modal
        const closeHistoryBtn = document.querySelector('.close-history');
        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', () => this.toggleHistoryModal());
        }
        
        // Click outside modal to close
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('historyModal');
            if (e.target === modal) {
                this.toggleHistoryModal();
            }
        });
    }
    
    showWelcomeMessage() {
        const welcomeMessage = {
            type: 'assistant',
            content: "Hello! I'm NIYAsaathi, your AI companion for loneliness support. I'm here to listen, understand, and help you navigate through feelings of loneliness. How are you feeling today?",
            timestamp: new Date().toISOString()
        };
        
        this.addMessageToChat(welcomeMessage);
        this.conversationHistory.push(welcomeMessage);
        this.saveConversationHistory();
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processAudioMessage(audioBlob);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateMicButton(true);
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Could not access microphone. Please check permissions.');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.updateMicButton(false);
        }
    }
    
    updateMicButton(isRecording) {
        const micButton = document.getElementById('micButton');
        if (micButton) {
            if (isRecording) {
                micButton.innerHTML = '<i class="fas fa-stop"></i>';
                micButton.classList.add('recording');
            } else {
                micButton.innerHTML = '<i class="fas fa-microphone"></i>';
                micButton.classList.remove('recording');
            }
        }
    }
    
    async processAudioMessage(audioBlob) {
        try {
            this.setProcessing(true);
            
            // Convert audio to text (you can integrate with Azure Speech Services here)
            const text = await this.audioToText(audioBlob);
            
            if (text) {
                await this.sendMessage(text);
            } else {
                this.showError('Could not understand audio. Please try again.');
            }
            
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showError('Error processing audio message.');
        } finally {
            this.setProcessing(false);
        }
    }
    
    async audioToText(audioBlob) {
        // For now, return a placeholder
        // In production, integrate with Azure Speech Services or other speech-to-text service
        return "Hello, this is a test message from audio input.";
    }
    
    async sendTextMessage() {
        const textInput = document.getElementById('textInput');
        const message = textInput.value.trim();
        
        if (!message || this.isProcessing) return;
        
        textInput.value = '';
        await this.sendMessage(message);
    }
    
    async sendMessage(message) {
        try {
            this.setProcessing(true);
            
            // Add user message to chat
            const userMessage = {
                type: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };
            
            this.addMessageToChat(userMessage);
            this.conversationHistory.push(userMessage);
            
            // Send to Firebase Functions
            const response = await this.callAPI('/chat', {
                message: message,
                user_data: this.userData
            });
            
            if (response.success) {
                // Update user data and conversation state
                this.userData = response.user_data || {};
                this.conversationState = response.conversation_state || {};
                
                // Add assistant response to chat
                const assistantMessage = {
                    type: 'assistant',
                    content: response.message,
                    timestamp: new Date().toISOString()
                };
                
                this.addMessageToChat(assistantMessage);
                this.conversationHistory.push(assistantMessage);
                
                // Handle text-to-speech if needed
                if (response.should_speak) {
                    await this.speakText(response.message);
                }
                
                // Handle intervention data
                if (response.intervention_data) {
                    this.handleInterventionData(response.intervention_data);
                }
                
            } else {
                this.showError(response.error || 'Failed to get response');
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        } finally {
            this.setProcessing(false);
        }
    }
    
    async callAPI(endpoint, data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }
    
    async speakText(text) {
        try {
            const response = await this.callAPI('/speak', { text });
            
            if (response.success) {
                // In production, integrate with Azure Speech Services
                // For now, use browser's built-in speech synthesis
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.rate = 0.9;
                    utterance.pitch = 1.1;
                    utterance.volume = 0.8;
                    
                    // Try to find an Indian female voice
                    const voices = speechSynthesis.getVoices();
                    const indianVoice = voices.find(voice => 
                        voice.lang.includes('en-IN') || 
                        voice.name.toLowerCase().includes('indian') ||
                        voice.name.toLowerCase().includes('priya') ||
                        voice.name.toLowerCase().includes('neha')
                    );
                    
                    if (indianVoice) {
                        utterance.voice = indianVoice;
                    }
                    
                    speechSynthesis.speak(utterance);
                }
            }
        } catch (error) {
            console.error('Error with text-to-speech:', error);
        }
    }
    
    handleInterventionData(interventionData) {
        if (interventionData.completed) {
            // Show completion message or progress indicator
            console.log('Intervention completed:', interventionData.type);
        } else if (interventionData.stage !== undefined) {
            // Show progress indicator
            this.showProgressIndicator(interventionData.stage, interventionData.total_stages);
        }
    }
    
    showProgressIndicator(currentStage, totalStages) {
        const progress = (currentStage / totalStages) * 100;
        
        // You can add a progress bar or indicator here
        console.log(`Intervention progress: ${progress}%`);
    }
    
    addMessageToChat(message) {
        const chatContainer = document.getElementById('chatContainer');
        if (!chatContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message.content;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(message.timestamp);
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        
        const sendButton = document.getElementById('sendButton');
        const textInput = document.getElementById('textInput');
        const micButton = document.getElementById('micButton');
        
        if (sendButton) {
            sendButton.disabled = isProcessing;
            sendButton.innerHTML = isProcessing ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
        }
        
        if (textInput) {
            textInput.disabled = isProcessing;
        }
        
        if (micButton) {
            micButton.disabled = isProcessing;
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Remove error message after 5 seconds
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }
    }
    
    toggleHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
            
            if (modal.style.display === 'block') {
                this.loadConversationHistory();
            }
        }
    }
    
    loadConversationHistory() {
        const savedHistory = localStorage.getItem('niyasaathi_conversation_history');
        if (savedHistory) {
            try {
                this.conversationHistory = JSON.parse(savedHistory);
            } catch (error) {
                console.error('Error loading conversation history:', error);
                this.conversationHistory = [];
            }
        }
        
        this.displayHistoryInModal();
    }
    
    displayHistoryInModal() {
        const historyContainer = document.getElementById('historyContainer');
        if (!historyContainer) return;
        
        historyContainer.innerHTML = '';
        
        if (this.conversationHistory.length === 0) {
            historyContainer.innerHTML = '<p class="no-history">No conversation history yet.</p>';
            return;
        }
        
        // Group conversations by date
        const groupedHistory = this.groupConversationsByDate(this.conversationHistory);
        
        Object.keys(groupedHistory).forEach(date => {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'history-date-group';
            
            const dateHeader = document.createElement('h3');
            dateHeader.textContent = this.formatDate(date);
            dateDiv.appendChild(dateHeader);
            
            groupedHistory[date].forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `history-message ${message.type}-message`;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'history-content';
                contentDiv.textContent = message.content;
                
                const timeDiv = document.createElement('div');
                timeDiv.className = 'history-time';
                timeDiv.textContent = this.formatTime(message.timestamp);
                
                messageDiv.appendChild(contentDiv);
                messageDiv.appendChild(timeDiv);
                dateDiv.appendChild(messageDiv);
            });
            
            historyContainer.appendChild(dateDiv);
        });
    }
    
    groupConversationsByDate(conversations) {
        const grouped = {};
        
        conversations.forEach(message => {
            const date = new Date(message.timestamp).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(message);
        });
        
        return grouped;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    }
    
    saveConversationHistory() {
        try {
            localStorage.setItem('niyasaathi_conversation_history', JSON.stringify(this.conversationHistory));
        } catch (error) {
            console.error('Error saving conversation history:', error);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NIYAsaathiApp();
});

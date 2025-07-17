// Frontend JavaScript placeholder

class NIYAsaathiApp {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.isAuthenticated = false;
        this.voiceEnabled = false;
        this.voiceOutputEnabled = true;
        this.voiceSpeed = 1.0;
        this.speechRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isRecording = false;
        this.isTyping = false;
        this.userHasInteracted = false;
        this.pendingAudio = null;
        this.lastMessageTimestamp = null;
        this.currentAudioRequest = null;
        
        // Firebase Functions URLs - will be replaced with actual URLs after deployment
        this.API_BASE_URL = 'https://us-central1-niyasaathi-loneliness-coach.cloudfunctions.net'; // Firebase project ID
        this.FIREBASE_FUNCTIONS = {
            sendVerificationCode: `${this.API_BASE_URL}/sendVerificationCode`,
            verifyCode: `${this.API_BASE_URL}/verifyCode`,
            handleMessage: `${this.API_BASE_URL}/handleMessage`,
            getUserData: `${this.API_BASE_URL}/getUserData`,
            healthCheck: `${this.API_BASE_URL}/healthCheck`
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkAuthentication();
        this.setupVoice();
        this.loadSettings();
    }
    
    setupEventListeners() {
        // Authentication
        document.getElementById('send-code').addEventListener('click', () => this.sendVerificationCode());
        document.getElementById('verify-code').addEventListener('click', () => this.verifyCode());
        document.getElementById('phone-number').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendVerificationCode();
        });
        document.getElementById('verification-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.verifyCode();
        });
        
        // Chat
        document.getElementById('send-btn').addEventListener('click', () => {
            this.userHasInteracted = true;
            this.sendMessage();
        });
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.userHasInteracted = true;
                this.sendMessage();
            }
        });
        document.getElementById('message-input').addEventListener('input', () => this.updateSendButton());
        
        // Voice
        document.getElementById('voice-input-btn').addEventListener('click', () => this.toggleVoiceInput());
        document.getElementById('stop-voice').addEventListener('click', () => this.stopVoiceInput());
        document.getElementById('voice-toggle').addEventListener('click', () => this.toggleVoiceOutput());
        
        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.hideSettings());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('voice-output-toggle').addEventListener('change', (e) => {
            this.voiceOutputEnabled = e.target.checked;
            this.saveSettings();
        });
        document.getElementById('voice-speed').addEventListener('change', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
            this.saveSettings();
        });
        
        // History
        document.getElementById('history-btn').addEventListener('click', () => this.showHistory());
        document.getElementById('close-history').addEventListener('click', () => this.hideHistory());
        
        // Voice permission
        document.getElementById('allow-voice').addEventListener('click', () => this.requestVoicePermission());
        document.getElementById('deny-voice').addEventListener('click', () => this.hideVoicePermissionModal());
        
        // Modal close on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }
    
    checkAuthentication() {
        const token = localStorage.getItem('niyasaathi_token');
        const userData = localStorage.getItem('niyasaathi_user');
        
        if (token && userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.isAuthenticated = true;
                this.showChatScreen();
                this.loadUserData();
            } catch (error) {
                console.error('Error parsing user data:', error);
                this.logout();
            }
        }
    }
    
    async sendVerificationCode() {
        const phoneNumber = document.getElementById('phone-number').value.trim();
        
        if (!phoneNumber) {
            this.showAuthStatus('Please enter a phone number', 'error');
            return;
        }
        
        if (!this.isValidPhoneNumber(phoneNumber)) {
            this.showAuthStatus('Please enter a valid phone number', 'error');
            return;
        }
        
        const sendBtn = document.getElementById('send-code');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        try {
            const response = await fetch(this.FIREBASE_FUNCTIONS.sendVerificationCode, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone_number: phoneNumber })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showAuthStatus('Verification code sent!', 'success');
                document.querySelector('.phone-input').style.display = 'none';
                document.querySelector('.verification-input').style.display = 'flex';
                document.getElementById('verification-code').focus();
            } else {
                this.showAuthStatus(data.error || 'Failed to send code', 'error');
            }
        } catch (error) {
            console.error('Error sending code:', error);
            this.showAuthStatus('Network error. Please try again.', 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }
    
    async verifyCode() {
        const phoneNumber = document.getElementById('phone-number').value.trim();
        const code = document.getElementById('verification-code').value.trim();
        
        if (!code) {
            this.showAuthStatus('Please enter the verification code', 'error');
            return;
        }
        
        const verifyBtn = document.getElementById('verify-code');
        const originalText = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        
        try {
            const response = await fetch(this.FIREBASE_FUNCTIONS.verifyCode, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    phone_number: phoneNumber,
                    code: code 
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.user;
                localStorage.setItem('niyasaathi_token', data.token);
                localStorage.setItem('niyasaathi_user', JSON.stringify(data.user));
                this.isAuthenticated = true;
                
                this.showAuthStatus('Welcome to NIYAsaathi!', 'success');
                setTimeout(() => {
                    this.showChatScreen();
                    this.loadUserData();
                }, 1000);
            } else {
                this.showAuthStatus(data.error || 'Invalid verification code', 'error');
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            this.showAuthStatus('Network error. Please try again.', 'error');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalText;
        }
    }
    
    showAuthStatus(message, type) {
        const statusEl = document.getElementById('auth-status');
        statusEl.textContent = message;
        statusEl.className = `auth-status ${type}`;
    }
    
    isValidPhoneNumber(phone) {
        // Basic phone number validation
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }
    
    showChatScreen() {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('chat-screen').classList.add('active');
        document.getElementById('user-phone').textContent = this.currentUser.phone_number;
        
        // Don't show welcome message here - let loadUserData handle it
    }
    
    async loadUserData() {
        try {
            const response = await fetch(this.FIREBASE_FUNCTIONS.getUserData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('niyasaathi_token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userData = data.user_data;
                
                // Check if user has conversation history
                const hasConversationHistory = this.userData.conversation_history && this.userData.conversation_history.length > 0;
                
                if (this.userData.last_coach_message) {
                    // User has a last coach message (returning user) - play it
                    this.addMessage('coach', this.userData.last_coach_message, true);
                } else {
                    // First-time user - show welcome message and play it
                    this.addMessage('coach', 'Hi there! I\'m NIYAsaathi. I\'m here to walk with you through something that\'s real, tender, and often unspoken—loneliness. Let\'s take it one step at a time, together. Have you been feeling lonely recently?', true);
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message || this.isTyping) return;
        
        // Stop any playing audio when user sends a message
        this.stopAllAudio();
        
        // Clear input and disable send button
        input.value = '';
        this.updateSendButton();
        
        // Add user message to chat
        this.addMessage('user', message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await fetch(this.FIREBASE_FUNCTIONS.handleMessage, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('niyasaathi_token')}`
                },
                body: JSON.stringify({
                    message: message
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.hideTypingIndicator();
                this.addMessage('coach', data.response, true); // Use Azure TTS for coach responses
                
                // Update user data
                this.userData = data.user_data;
                
                // Schedule nudge if intervention was provided
                if (data.intervention_type) {
                    this.scheduleNudge(data.intervention_type);
                }
            } else {
                this.hideTypingIndicator();
                this.addMessage('coach', 'I apologize, but I\'m having trouble processing your message right now. Please try again in a moment.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('coach', 'I\'m experiencing some technical difficulties. Please try again in a moment.');
        }
    }
    
    addMessage(sender, text, playBackendAudio = false) {
        console.log('=== ADD MESSAGE CALLED ===');
        console.log('Sender:', sender);
        console.log('Text:', text);
        console.log('PlayBackendAudio:', playBackendAudio);
        console.log('VoiceOutputEnabled:', this.voiceOutputEnabled);
        console.log('==========================');
        
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${sender === 'coach' ? '<i class="fas fa-heart"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content">
                <div class="message-text">${this.formatMessage(text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Play backend audio if enabled and it's from coach
        if (sender === 'coach' && this.voiceOutputEnabled && playBackendAudio) {
            // Stop any existing audio first
            this.stopAllAudio();
            
            // Cancel any ongoing audio request
            if (this.currentAudioRequest) {
                console.log('Cancelling previous audio request');
                this.currentAudioRequest = null;
            }
            
            // Generate a simple timestamp for this message
            const messageTimestamp = Date.now();
            this.lastMessageTimestamp = messageTimestamp;
            
            console.log('Generated message timestamp:', messageTimestamp, 'for text:', text);
            
            // Simple delay to ensure DOM is updated
            setTimeout(() => {
                // Only play audio if this is still the most recent message
                if (this.lastMessageTimestamp !== messageTimestamp) {
                    console.log('This is no longer the most recent message, skipping audio playback for timestamp:', messageTimestamp);
                    return;
                }
                
                console.log('This is the most recent message, playing audio for timestamp:', messageTimestamp, 'Text:', text);
                
                // Create a unique request ID to prevent duplicates
                const requestId = Date.now() + Math.random();
                this.currentAudioRequest = requestId;
                
                // Use the relative path - Firebase hosting will rewrite this to the function
                fetch('/speak', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                })
                .then(res => {
                    // Check if this request is still current
                    if (this.currentAudioRequest !== requestId) {
                        console.log('Audio request superseded, aborting');
                        return;
                    }
                    
                    console.log('Google TTS response status:', res.status);
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    return res.blob();
                })
                .then(blob => {
                    // Check if this request is still current
                    if (this.currentAudioRequest !== requestId) {
                        console.log('Audio request superseded, aborting blob processing');
                        return;
                    }
                    
                    console.log('Google TTS blob received, size:', blob.size, 'bytes');
                    const audioUrl = URL.createObjectURL(blob);
                    const audio = new Audio(audioUrl);
                    this.pendingAudio = audio;
                    
                    audio.play().catch(error => {
                        // Check if this request is still current
                        if (this.currentAudioRequest !== requestId) {
                            console.log('Audio request superseded, not falling back to browser TTS');
                            return;
                        }
                        
                        console.error('Google TTS audio play failed:', error);
                        console.error('Error name:', error.name);
                        console.error('Error message:', error.message);
                        // Fallback to browser TTS
                        console.log('Falling back to browser TTS due to play error');
                        this.speakMessage(text);
                    });
                    
                    audio.addEventListener('ended', () => {
                        console.log('Google TTS audio playback completed');
                        URL.revokeObjectURL(audioUrl);
                        this.pendingAudio = null;
                        this.currentAudioRequest = null;
                    });
                    
                    audio.addEventListener('error', (e) => {
                        console.error('Google TTS audio error event:', e);
                        console.error('Audio error details:', audio.error);
                    });
                })
                .catch(error => {
                    // Check if this request is still current
                    if (this.currentAudioRequest !== requestId) {
                        console.log('Audio request superseded, not falling back to browser TTS');
                        return;
                    }
                    
                    console.error('Google TTS fetch failed:', error);
                    console.error('Error name:', error.name);
                    console.error('Error message:', error.message);
                    // Fallback to browser TTS
                    console.log('Falling back to browser TTS due to fetch error');
                    this.speakMessage(text);
                    this.currentAudioRequest = null;
                });
            }, 100); // Shorter delay - just enough for DOM update
        } else if (sender === 'coach' && this.voiceOutputEnabled) {
            // Use browser TTS as fallback or when backend audio is disabled
            this.speakMessage(text);
        }
    }
    
    formatMessage(text) {
        // Convert line breaks to <br> tags and escape HTML
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br>');
    }
    
    showTypingIndicator() {
        this.isTyping = true;
        document.getElementById('typing-indicator').style.display = 'flex';
        document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
    }
    
    hideTypingIndicator() {
        this.isTyping = false;
        document.getElementById('typing-indicator').style.display = 'none';
    }
    
    updateSendButton() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        sendBtn.disabled = !input.value.trim() || this.isTyping;
    }
    
    // Voice functionality
    setupVoice() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = false;
            this.speechRecognition.lang = 'en-US';
            
            this.speechRecognition.onstart = () => {
                this.isRecording = true;
                document.getElementById('voice-input-btn').classList.add('recording');
                document.getElementById('voice-status').style.display = 'flex';
            };
            
            this.speechRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('message-input').value = transcript;
                this.updateSendButton();
            };
            
            this.speechRecognition.onend = () => {
                this.isRecording = false;
                document.getElementById('voice-input-btn').classList.remove('recording');
                document.getElementById('voice-status').style.display = 'none';
            };
            
            this.speechRecognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                document.getElementById('voice-input-btn').classList.remove('recording');
                document.getElementById('voice-status').style.display = 'none';
            };
            
            this.voiceEnabled = true;
        }
    }
    
    toggleVoiceInput() {
        if (!this.voiceEnabled) {
            this.showVoicePermissionModal();
            return;
        }
        
        if (this.isRecording) {
            this.stopVoiceInput();
        } else {
            this.startVoiceInput();
        }
    }
    
    startVoiceInput() {
        if (this.speechRecognition) {
            this.speechRecognition.start();
        }
    }
    
    stopVoiceInput() {
        if (this.speechRecognition) {
            this.speechRecognition.stop();
        }
    }
    
    toggleVoiceOutput() {
        this.voiceOutputEnabled = !this.voiceOutputEnabled;
        const btn = document.getElementById('voice-toggle');
        btn.classList.toggle('active', this.voiceOutputEnabled);
    }
    
    speakMessage(text) {
        if (this.speechSynthesis && this.voiceOutputEnabled) {
            // Cancel any ongoing speech
            this.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = this.voiceSpeed;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            // Try to use a female voice for NIYAsaathi
            const voices = this.speechSynthesis.getVoices();
            const femaleVoice = voices.find(voice => 
                voice.lang.includes('en') && 
                (voice.name.includes('female') || voice.name.includes('Samantha') || voice.name.includes('Victoria'))
            );
            
            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }
            
            this.speechSynthesis.speak(utterance);
        }
    }
    
    showVoicePermissionModal() {
        document.getElementById('voice-permission-modal').classList.add('active');
    }
    
    hideVoicePermissionModal() {
        document.getElementById('voice-permission-modal').classList.remove('active');
    }
    
    async requestVoicePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            this.voiceEnabled = true;
            this.hideVoicePermissionModal();
            this.startVoiceInput();
        } catch (error) {
            console.error('Error requesting microphone permission:', error);
            this.hideVoicePermissionModal();
        }
    }
    
    // Settings
    showSettings() {
        document.getElementById('settings-modal').classList.add('active');
    }
    
    hideSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    }
    
    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('niyasaathi_settings') || '{}');
        this.voiceOutputEnabled = settings.voiceOutputEnabled !== undefined ? settings.voiceOutputEnabled : true;
        this.voiceSpeed = settings.voiceSpeed || 1.0;
        
        document.getElementById('voice-output-toggle').checked = this.voiceOutputEnabled;
        document.getElementById('voice-speed').value = this.voiceSpeed;
        document.getElementById('voice-toggle').classList.toggle('active', this.voiceOutputEnabled);
    }
    
    saveSettings() {
        const settings = {
            voiceOutputEnabled: this.voiceOutputEnabled,
            voiceSpeed: this.voiceSpeed
        };
        localStorage.setItem('niyasaathi_settings', JSON.stringify(settings));
    }
    
    async scheduleNudge(interventionType) {
        try {
            await fetch(`${this.API_BASE_URL}/register_nudge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('niyasaathi_token')}`
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id,
                    intervention_type: interventionType
                })
            });
        } catch (error) {
            console.error('Error scheduling nudge:', error);
        }
    }
    
    logout() {
        localStorage.removeItem('niyasaathi_token');
        localStorage.removeItem('niyasaathi_user');
        this.currentUser = null;
        this.userData = null;
        this.isAuthenticated = false;
        
        document.getElementById('chat-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('chat-messages').innerHTML = '';
        document.getElementById('phone-number').value = '';
        document.getElementById('verification-code').value = '';
        document.querySelector('.phone-input').style.display = 'flex';
        document.querySelector('.verification-input').style.display = 'none';
        document.getElementById('auth-status').textContent = '';
        document.getElementById('auth-status').className = 'auth-status';
        
        this.hideSettings();
    }
    
    // History
    showHistory() {
        this.loadHistory();
        document.getElementById('history-modal').classList.add('active');
    }
    
    hideHistory() {
        document.getElementById('history-modal').classList.remove('active');
    }
    
    loadHistory() {
        const historyContainer = document.getElementById('history-container');
        
        if (!this.userData || !this.userData.conversation_history || this.userData.conversation_history.length === 0) {
            historyContainer.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-history"></i>
                    <p>No conversation history yet</p>
                </div>
            `;
            return;
        }
        
        const history = this.userData.conversation_history;
        const groupedHistory = this.groupHistoryByDate(history);
        
        historyContainer.innerHTML = '';
        
        Object.keys(groupedHistory).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const dayHistory = groupedHistory[date];
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            const lastMessage = dayHistory[dayHistory.length - 1];
            const preview = lastMessage.user_message || lastMessage.coach_message || 'Conversation';
            const messageCount = dayHistory.length;
            
            historyItem.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-date">${formattedDate}</span>
                    <span class="history-item-time">${messageCount} messages</span>
                </div>
                <div class="history-item-preview">${this.truncateText(preview, 100)}</div>
            `;
            
            historyItem.addEventListener('click', () => {
                this.loadHistoryConversation(dayHistory);
            });
            
            historyContainer.appendChild(historyItem);
        });
    }
    
    groupHistoryByDate(history) {
        const grouped = {};
        
        history.forEach(entry => {
            const date = new Date(entry.timestamp).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(entry);
        });
        
        return grouped;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    loadHistoryConversation(dayHistory) {
        // Clear current chat
        document.getElementById('chat-messages').innerHTML = '';
        
        // Add historical messages
        dayHistory.forEach(entry => {
            if (entry.coach_message) {
                this.addMessage('coach', entry.coach_message, false);
            }
            if (entry.user_message) {
                this.addMessage('user', entry.user_message, false);
            }
        });
        
        this.hideHistory();
    }

    // Stop all audio
    stopAllAudio() {
        console.log('Stopping all audio');
        
        // Cancel any ongoing speech synthesis
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        
        // Stop any pending audio
        if (this.pendingAudio) {
            console.log('Stopping current audio playback');
            this.pendingAudio.pause();
            this.pendingAudio.currentTime = 0;
            this.pendingAudio = null;
        }
        
        // Clear current audio request
        if (this.currentAudioRequest) {
            console.log('Clearing current audio request');
            this.currentAudioRequest = null;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NIYAsaathiApp();
});
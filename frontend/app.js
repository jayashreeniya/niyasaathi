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
        
        this.API_BASE_URL = 'http://localhost:5000'; // Update with your backend URL
        
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
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
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
            const response = await fetch(`${this.API_BASE_URL}/auth/send-code`, {
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
            const response = await fetch(`${this.API_BASE_URL}/auth/verify-code`, {
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
        
        // Show welcome message
        this.addMessage('coach', 'Hi there! I\'m NIYAsaathi. I\'m here to walk with you through something that\'s real, tender, and often unspoken—loneliness. Let\'s take it one step at a time, together. Have you been feeling lonely recently?');
    }
    
    async loadUserData() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/user/data`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('niyasaathi_token')}`
                }
            });
            
            if (response.ok) {
                this.userData = await response.json();
                // Resume conversation from where user left off
                if (this.userData.last_coach_message) {
                    this.addMessage('coach', this.userData.last_coach_message);
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
        
        // Add user message to chat
        this.addMessage('user', message);
        input.value = '';
        this.updateSendButton();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('niyasaathi_token')}`
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id,
                    message: message
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.hideTypingIndicator();
                this.addMessage('coach', data.text, true); // pass true to trigger backend audio
                
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
            fetch(`${this.API_BASE_URL}/speak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            })
            .then(res => res.blob())
            .then(blob => {
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                audio.play();
            });
        }
        // Remove or comment out browser TTS
        // if (sender === 'coach' && this.voiceOutputEnabled) {
        //     this.speakMessage(text);
        // }
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NIYAsaathiApp();
});

function sendMessage(userInput) {
  fetch('http://localhost:5000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userInput })
  })
  .then(response => response.json())
  .then(data => {
    // Display the text
    document.getElementById('response').innerText = data.text;

    // Play the audio
    fetch('http://localhost:5000/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data.text })
    })
    .then(res => res.blob())
    .then(blob => {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const messagesContainer = document.getElementById('messages-container');
    const authSection = document.getElementById('auth-section');
    const userIdInput = document.getElementById('user-id-input');
    const startChatBtn = document.getElementById('start-chat-btn');
    const inputArea = document.getElementById('input-area');

    const switchUserBtn = document.getElementById('switch-user-btn');
    let userId = '';

    // Set the API Base URL
    // If running on GitHub Pages, point to your Render internal/external URL
    // If running locally, use localhost
    const API_BASE_URL = window.location.hostname.includes('github.io') 
        ? 'https://studybot-an-intelligent-ai-learning.onrender.com' 
        : window.location.origin;

    console.log("Using API Base URL:", API_BASE_URL);

    // Handle Start Chat / Login
    startChatBtn.addEventListener('click', async () => {
        const id = userIdInput.value.trim();
        if (!id) {
            alert("Please enter a User ID to continue.");
            return;
        }

        userId = id;
        authSection.style.display = 'none';
        inputArea.style.display = 'block';
        
        // Clear screen before loading
        messagesContainer.innerHTML = '';
        
        // Show Loading/Welcome in Chat
        addMessage(`Profile connected: <b>${userId}</b>. Your study history has been synced.`, 'bot');
        
        // Load history for this user
        loadHistory();
    });

    // Handle Switch User
    switchUserBtn.addEventListener('click', () => {
        if (confirm("Switch user? Current session will be ended and new history will load.")) {
            userId = '';
            userIdInput.value = '';
            authSection.style.display = 'flex';
            inputArea.style.display = 'none';
            messagesContainer.innerHTML = '';
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
    });

    // Handle form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        userInput.value = '';
        userInput.style.height = 'auto';

        addMessage(message, 'user');
        
        const typingId = showTypingIndicator();

        try {
            // Use dynamic base URL for cross-environment support
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: message,
                    user_id: userId
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            removeTypingIndicator(typingId);

            if (data.response) {
                addMessage(data.response, 'bot');
            } else {
                addMessage("I'm sorry, I'm having trouble thinking right now. Could you repeat that?", 'bot');
            }
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator(typingId);
            addMessage("I lost my connection to the study server. Please check your internet.", 'bot');
        }
    });

    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        
        const content = document.createElement('div');
        content.classList.add('msg-content');
        
        // Use innerHTML for the bot to allow basic formatting (like <br> or bold)
        if (role === 'bot') {
            content.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            content.textContent = text;
        }

        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const indicator = document.createElement('div');
        indicator.id = id;
        indicator.classList.add('message', 'bot');
        indicator.innerHTML = `
            <div class="msg-content">
                <div class="typing-indicator" style="display: flex; gap: 4px;">
                    <div class="dot" style="width:6px; height:6px; background:#94a3b8; border-radius:50%; animation: pulse 1.5s infinite;"></div>
                    <div class="dot" style="width:6px; height:6px; background:#94a3b8; border-radius:50%; animation: pulse 1.5s infinite 0.2s;"></div>
                    <div class="dot" style="width:6px; height:6px; background:#94a3b8; border-radius:50%; animation: pulse 1.5s infinite 0.4s;"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        const indicator = document.getElementById(id);
        if (indicator) indicator.remove();
    }

    async function loadHistory() {
        if (!userId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/history/${userId}`);
            if (!response.ok) return;
            const history = await response.json();
            
            if (history && history.length > 0) {
                // Clear initial welcome message if history exists to avoid double welcome
                const welcomeMsg = messagesContainer.querySelector('.message.bot');
                if (welcomeMsg) welcomeMsg.remove();
                
                history.forEach(item => {
                    addMessage(item.message, item.role === 'user' ? 'user' : 'bot');
                });
            }
        } catch (err) {
            console.warn('History not found or server error:', err);
        }
    }
});

// Pulse animation for typing dots
const style = document.createElement('style');
style.innerHTML = `
    @keyframes pulse {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
    }
`;
document.head.appendChild(style);

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
        
        messagesContainer.innerHTML = '';
        addMessage(`Profile connected: <b>${userId}</b>. Syncing your study history...`, 'bot');
        
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
            // Increased timeout handling for Render cold starts
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify({
                    question: message,
                    user_id: userId
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText || 'Internal Server Error'}`);
            }

            const data = await response.json();
            removeTypingIndicator(typingId);

            if (data.response) {
                addMessage(data.response, 'bot');
            } else {
                addMessage("I'm sorry, I'm having trouble thinking right now. Could you repeat that?", 'bot');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            removeTypingIndicator(typingId);
            
            let errorMsg = "I lost my connection to the study server.";
            if (error.name === 'AbortError') {
                errorMsg = "The server is taking too long to respond (Render might be waking up). Please try again in 30 seconds.";
            } else {
                errorMsg += `<br><small style="opacity:0.7">Error Details: ${error.message}</small>`;
            }
            
            addMessage(errorMsg, 'bot');
        }
    });

    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        
        const content = document.createElement('div');
        content.classList.add('msg-content');
        
        if (role === 'bot') {
            // Safety filter to strip accidental markdown symbols
            let cleanText = text
                .replace(/[#*_{}\[\]()]/g, '') // Remove # * _ { } [ ] ( )
                .replace(/-{3,}/g, '')         // Remove --- style lines
                .replace(/\n\s*- /g, '\n• ')   // Convert markdown bullets to clean dots
                .replace(/^\s*- /g, '• ');      // Convert starting bullet
            
            content.innerHTML = cleanText.replace(/\n/g, '<br>');
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
            const response = await fetch(`${API_BASE_URL}/history/${userId}`, {
                mode: 'cors'
            });
            if (!response.ok) return;
            const history = await response.json();
            
            if (history && history.length > 0) {
                messagesContainer.innerHTML = ''; // Full clear
                history.forEach(item => {
                    addMessage(item.message, item.role === 'user' ? 'user' : 'bot');
                });
            }
        } catch (err) {
            console.warn('History sync error:', err);
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

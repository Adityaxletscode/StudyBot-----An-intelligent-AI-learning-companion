document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const messagesContainer = document.getElementById('messages-container');
    const authSection = document.getElementById('auth-section');
    const userIdInput = document.getElementById('user-id-input');
    const userPassInput = document.getElementById('user-pass-input');
    const startChatBtn = document.getElementById('start-chat-btn');
    const inputArea = document.getElementById('input-area');
    const logoutBtn = document.getElementById('logout-btn');

    let userId = '';
    let userPass = '';

    // Set the API Base URL
    const API_BASE_URL = window.location.hostname.includes('github.io') 
        ? 'https://studybot-an-intelligent-ai-learning.onrender.com' 
        : window.location.origin;

    console.log("Using API Base URL:", API_BASE_URL);

    // Handle Start Chat / Login / Register
    startChatBtn.addEventListener('click', async () => {
        const id = userIdInput.value.trim();
        const pass = userPassInput.value.trim();
        
        if (!id || !pass) {
            alert("Please enter both Username and Password.");
            return;
        }

        startChatBtn.disabled = true;
        startChatBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

        try {
            const response = await fetch(`${API_BASE_URL}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: id, password: pass })
            });

            const data = await response.json();

            if (response.ok) {
                userId = id;
                userPass = pass;
                authSection.style.display = 'none';
                inputArea.style.display = 'block';
                
                messagesContainer.innerHTML = '';
                addMessage(`Profile connected: <b>${userId}</b>. Syncing your private study history...`, 'bot');
                
                loadHistory();
            } else {
                alert(data.message || "Authentication failed.");
            }
        } catch (err) {
            console.error("Auth error:", err);
            alert("Failed to connect to server. Check your internet.");
        } finally {
            startChatBtn.disabled = false;
            startChatBtn.innerHTML = 'Sign In / Register <i class="fas fa-arrow-right"></i>';
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to logout?")) {
            userId = '';
            userPass = '';
            userIdInput.value = '';
            userPassInput.value = '';
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 35000); 

            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify({
                    question: message,
                    user_id: userId,
                    password: userPass
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.response || `Error ${response.status}`);
            }

            const data = await response.json();
            removeTypingIndicator(typingId);

            if (data.response) {
                addMessage(data.response, 'bot');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            removeTypingIndicator(typingId);
            addMessage(`<b>Connection Error:</b> ${error.message}`, 'bot');
        }
    });

    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        
        const content = document.createElement('div');
        content.classList.add('msg-content');
        
        if (role === 'bot') {
            let cleanText = text
                .replace(/[#*_{}\[\]()]/g, '')
                .replace(/-{3,}/g, '')
                .replace(/\n\s*- /g, '\n• ')
                .replace(/^\s*- /g, '• ');
            
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
            const response = await fetch(`${API_BASE_URL}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({ user_id: userId, password: userPass })
            });
            if (!response.ok) return;
            const history = await response.json();
            
            if (history && history.length > 0) {
                messagesContainer.innerHTML = '';
                history.forEach(item => {
                    addMessage(item.message, item.role === 'user' ? 'user' : 'bot');
                });
            }
        } catch (err) {
            console.warn('History sync error:', err);
        }
    }
});

const style = document.createElement('style');
style.innerHTML = `
    @keyframes pulse {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
    }
`;
document.head.appendChild(style);

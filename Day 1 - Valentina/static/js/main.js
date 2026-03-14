/* ═══════════════════════════════════════════
   Personal Finance AI Advisor — JavaScript
   ═══════════════════════════════════════════ */

const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const chatSendBtn  = document.getElementById('chat-send-btn');
const welcomeScreen= document.getElementById('welcome-screen');
const sidebar      = document.getElementById('sidebar');

// ── Tool label map ──────────────────────────
const toolLabels = {
    'tavily_search_results_json': '🔍 Web Search',
    'read_sample_portfolio':      '📊 Portfolio Reader',
};

// ── Sidebar toggle (mobile) ─────────────────
function toggleSidebar() {
    sidebar.classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768
        && sidebar.classList.contains('open')
        && !sidebar.contains(e.target)
        && !e.target.closest('.menu-btn')) {
        sidebar.classList.remove('open');
    }
});

// ── Send suggestion from chips/sidebar ──────
function sendSuggestion(text) {
    chatInput.value = text;
    sendMessage(new Event('submit'));
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

// ── Send message (with SSE streaming status) ───
async function sendMessage(e) {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;

    // Hide welcome screen
    if (welcomeScreen) welcomeScreen.classList.add('hidden');

    appendMessage(msg, 'user');
    chatInput.value = '';
    chatSendBtn.disabled = true;

    const statusEl = showStatus('Connecting...');

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const payload = JSON.parse(line.slice(6));

                if (payload.type === 'status') {
                    updateStatus(statusEl, payload.text, 'status');
                } else if (payload.type === 'tool') {
                    updateStatus(statusEl, payload.text, 'tool');
                } else if (payload.type === 'done') {
                    removeStatus(statusEl);
                    appendMessage(payload.response, 'bot', payload.tools || []);
                }
            }
        }
    } catch {
        removeStatus(statusEl);
        appendMessage('Sorry, I had trouble processing that. Please try again.', 'bot');
    }

    chatSendBtn.disabled = false;
    chatInput.focus();
}

// ── Append message to chat ──────────────────
function appendMessage(text, type, tools) {
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;

    const avatarEmoji = type === 'bot' ? '💰' : '👤';
    const name = type === 'bot' ? 'Finance Advisor' : 'You';

    // Simple markdown-ish formatting
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n- /g, '\n• ')
        .replace(/\n/g, '<br>');

    let toolsHtml = '';
    if (tools && tools.length > 0) {
        const badges = tools.map(t => {
            const label = toolLabels[t] || `🛠️ ${t}`;
            return `<span class="tool-badge">${label}</span>`;
        }).join('');
        toolsHtml = `<div class="tool-calls-info"><span class="tool-calls-label">Tools used:</span>${badges}</div>`;
    }

    div.innerHTML = `
        <div class="msg-avatar">${avatarEmoji}</div>
        <div class="msg-content">
            <div class="msg-name">${name}</div>
            <div class="chat-bubble">${toolsHtml}${formatted}</div>
        </div>
    `;

    chatMessages.appendChild(div);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

// ── Live status indicator ────────────────────
function showStatus(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg bot';
    wrapper.innerHTML = `
        <div class="msg-avatar">💰</div>
        <div class="msg-content">
            <div class="msg-name">Finance Advisor</div>
            <div class="agent-status">
                <div class="status-dots"><span></span><span></span><span></span></div>
                <span class="status-text">${text}</span>
            </div>
        </div>
    `;
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    return wrapper;
}

function updateStatus(el, text, kind) {
    if (!el) return;
    const statusText = el.querySelector('.status-text');
    const statusBox = el.querySelector('.agent-status');
    if (statusText) statusText.textContent = text;
    if (statusBox) {
        statusBox.classList.remove('status-thinking', 'status-tool');
        statusBox.classList.add(kind === 'tool' ? 'status-tool' : 'status-thinking');
    }
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

function removeStatus(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ── Reset chat ──────────────────────────────
async function resetChat() {
    try {
        await fetch('/api/reset', { method: 'POST' });
    } catch { /* ignore */ }

    // Clear messages except welcome
    chatMessages.innerHTML = '';
    if (welcomeScreen) {
        welcomeScreen.classList.remove('hidden');
        chatMessages.appendChild(welcomeScreen);
    }
    showToast('Chat cleared');
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

// ── Toast ───────────────────────────────────
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ── Enter key to send ───────────────────────
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(e);
    }
});

// ── Form submit ─────────────────────────────
document.querySelector('.chat-input-form').addEventListener('submit', sendMessage);

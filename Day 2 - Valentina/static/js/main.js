/* ═══════════════════════════════════════════
   MammaChePiada! — Main JavaScript
   ═══════════════════════════════════════════ */

// ── DOM References ──────────────────────────
const navbar      = document.getElementById('navbar');
const menuGrid    = document.getElementById('menu-grid');
const menuFilters = document.getElementById('menu-filters');
const chatPopup   = document.getElementById('chat-popup');
const chatToggle  = document.getElementById('chat-toggle');
const chatMessages= document.getElementById('chat-messages');
const chatInput   = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatSuggest = document.getElementById('chat-suggestions');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartItems   = document.getElementById('cart-items');
const cartBadge   = document.getElementById('cart-badge');
const cartFooter  = document.getElementById('cart-footer');
const cartTotalEl = document.getElementById('cart-total');

let menuData = [];
let activeCategory = 'all';

// ── Navbar Scroll Effect ────────────────────
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ── Mobile Nav Toggle ───────────────────────
function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('open');
}
// Close mobile nav on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById('nav-links').classList.remove('open');
    });
});

// ── Menu Loading ────────────────────────────
async function loadMenu() {
    try {
        const res = await fetch('/api/menu');
        menuData = await res.json();
        buildFilters();
        renderMenu();
    } catch (err) {
        menuGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">Could not load menu. Please try again.</p>';
    }
}

function buildFilters() {
    const categories = [...new Set(menuData.map(p => p.Category))].sort();
    menuFilters.innerHTML = '<button class="filter-btn active" data-category="all">All</button>';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.category = cat;
        btn.textContent = cat;
        btn.onclick = () => filterMenu(cat, btn);
        menuFilters.appendChild(btn);
    });
}

function filterMenu(category, btn) {
    activeCategory = category;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.querySelector('[data-category="all"]')?.classList.add('active');
    renderMenu();
}

// Category emoji map
const categoryEmoji = {
    'Piadina': '🥙', 'Salad': '🥗', 'Bread': '🍞',
    'Cheese': '🧀', 'Meat': '🥩', 'Condiment': '🫒',
    'Dessert': '🍫', 'Vegetable': '🥬',
};

function renderMenu() {
    const filtered = activeCategory === 'all'
        ? menuData
        : menuData.filter(p => p.Category === activeCategory);

    if (filtered.length === 0) {
        menuGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">No items found.</p>';
        return;
    }

    menuGrid.innerHTML = filtered.map(p => {
        const emoji = categoryEmoji[p.Category] || '🍽️';
        const allergens = p.Allergens && p.Allergens !== 'None'
            ? p.Allergens.split(',').map(a => `<span class="badge badge-allergen">${a.trim()}</span>`).join('')
            : '';
        const vegBadge = p.Vegetarian ? '<span class="badge badge-veg">🌱 Vegetarian</span>' : '';
        const stockClass = p.Stock > 0 ? 'badge-stock' : 'badge-allergen';
        const stockText = p.Stock > 0 ? `${p.Stock} in stock` : 'Out of stock';

        return `
        <div class="menu-card">
            <div class="menu-card-header">
                <span class="menu-category-badge">${emoji} ${p.Category}</span>
                <span class="menu-card-price">€${p.Price.toFixed(2)}</span>
            </div>
            <div class="menu-card-body">
                <h3>${p['Product Name']}</h3>
                <p>${p.Description}</p>
                <div class="menu-card-meta">
                    ${vegBadge}
                    <span class="badge badge-cal">🔥 ${p.Calories} cal</span>
                    <span class="badge ${stockClass}">${stockText}</span>
                </div>
                ${allergens ? `<div class="menu-card-meta" style="margin-top:6px">${allergens}</div>` : ''}
            </div>
            <div class="menu-card-footer">
                <button class="add-cart-btn" onclick="addToCartDirect('${escapeHtml(p['Product Name'])}', ${p.Price})" ${p.Stock <= 0 ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
                    🛒 Add to Cart
                </button>
            </div>
        </div>`;
    }).join('');
}

function escapeHtml(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ── Cart Functions ──────────────────────────
function toggleCart() {
    cartSidebar.classList.toggle('open');
    cartOverlay.classList.toggle('open');
    if (cartSidebar.classList.contains('open')) loadCart();
}

async function loadCart() {
    try {
        const res = await fetch('/api/cart');
        const items = await res.json();
        renderCart(items);
    } catch {
        cartItems.innerHTML = '<div class="cart-empty"><p>Could not load cart</p></div>';
    }
}

function renderCart(items) {
    if (!items || items.length === 0) {
        cartItems.innerHTML = '<div class="cart-empty"><p>Your cart is empty</p><span>Browse our menu or ask our assistant!</span></div>';
        cartFooter.style.display = 'none';
        updateBadge(0);
        return;
    }

    cartItems.innerHTML = items.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <span>€${Number(item.price).toFixed(2)}</span>
            </div>
            <button class="cart-item-remove" onclick="removeCartItem('${item.id}')" title="Remove">✕</button>
        </div>
    `).join('');

    const total = items.reduce((sum, i) => sum + Number(i.price), 0);
    cartTotalEl.textContent = `€${total.toFixed(2)}`;
    cartFooter.style.display = 'flex';
    updateBadge(items.length);
}

function updateBadge(count) {
    cartBadge.textContent = count;
    cartBadge.classList.toggle('empty', count === 0);
}

async function removeCartItem(id) {
    try {
        await fetch(`/api/cart/${id}`, { method: 'DELETE' });
        loadCart();
        showToast('Item removed from cart');
    } catch { showToast('Failed to remove item'); }
}

async function clearCart() {
    try {
        await fetch('/api/cart/clear', { method: 'POST' });
        loadCart();
        showToast('Cart cleared');
    } catch { showToast('Failed to clear cart'); }
}

async function addToCartDirect(name, price) {
    try {
        // Use the chat agent to add to cart for a consistent experience
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Add ${name} to the cart with price ${price}` })
        });
        const data = await res.json();
        showToast(`${name} added to cart!`);
        loadCartBadge();
    } catch {
        showToast('Failed to add item');
    }
}

async function loadCartBadge() {
    try {
        const res = await fetch('/api/cart');
        const items = await res.json();
        updateBadge(items.length);
    } catch {}
}

// ── Chat Functions ──────────────────────────
let chatOpen = false;

function toggleChat() {
    chatOpen = !chatOpen;
    chatPopup.classList.toggle('open', chatOpen);
    chatToggle.classList.toggle('open', chatOpen);
    if (chatOpen) {
        setTimeout(() => chatInput.focus(), 300);
    }
}

function openChatWithMessage(msg) {
    if (!chatOpen) toggleChat();
    setTimeout(() => {
        chatInput.value = msg;
        sendMessage(new Event('submit'));
    }, 400);
}

function sendSuggestion(btn) {
    chatInput.value = btn.textContent;
    sendMessage(new Event('submit'));
    chatSuggest.style.display = 'none';
}

async function sendMessage(e) {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;

    // Add user message
    appendMessage(msg, 'user');
    chatInput.value = '';
    chatSendBtn.disabled = true;

    // Show typing indicator
    const typingEl = showTyping();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        removeTyping(typingEl);
        appendMessage(data.response, 'bot', data.tools || []);

        // If agent added something to cart, refresh badge
        if (data.response.toLowerCase().includes('added to cart') || data.response.toLowerCase().includes('aggiunto')) {
            loadCartBadge();
        }
    } catch {
        removeTyping(typingEl);
        appendMessage('Mi dispiace, I had trouble processing that. Please try again!', 'bot');
    }

    chatSendBtn.disabled = false;
    chatInput.focus();
}

const toolLabels = {
    'document_search': '📄 Document Search',
    'add_to_cart': '🛒 Add to Cart',
    'sql_db_query': '🗃️ Database Query',
    'sql_db_schema': '📋 Database Schema',
    'sql_db_list_tables': '📑 List Tables',
    'sql_db_query_checker': '✅ Query Checker',
};

function appendMessage(text, type, tools) {
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;

    // Simple markdown-like formatting
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    let toolsHtml = '';
    if (tools && tools.length > 0) {
        const badges = tools.map(t => {
            const label = toolLabels[t] || `🛠️ ${t}`;
            return `<span class="tool-badge">${label}</span>`;
        }).join('');
        toolsHtml = `<div class="tool-calls-info"><span class="tool-calls-label">Tools used:</span>${badges}</div>`;
    }

    div.innerHTML = `<div class="chat-bubble">${toolsHtml}${formatted}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'chat-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    return div;
}

function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ── Toast Notifications ─────────────────────
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ── Allow Enter key in chat ─────────────────
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(e);
    }
});

// ── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadMenu();
    loadCartBadge();
});

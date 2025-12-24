const API = window.location.origin;
let categories = [];
let channels = [];
let currentCategory = null;

const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMsg = document.getElementById('error-msg');
const categoriesSection = document.getElementById('categories-section');
const categoriesGrid = document.getElementById('categories-grid');
const channelsSection = document.getElementById('channels-section');
const channelsGrid = document.getElementById('channels-grid');
const categoryTitle = document.getElementById('category-title');
const backBtn = document.getElementById('back-btn');

document.addEventListener('DOMContentLoaded', loadCategories);
backBtn.addEventListener('click', showCategories);

async function loadCategories() {
    showLoading();
    try {
        const res = await fetch(`${API}/api/live/categories`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load');
        categories = data.categories || [];
        if (categories.length === 0) throw new Error('No categories found');
        renderCategories();
        showCategoriesSection();
    } catch (e) {
        showError(e.message);
    }
}

function renderCategories() {
    categoriesGrid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="selectCategory('${cat.category_id}', '${escapeHtml(cat.category_name)}')">
            <div class="category-icon">📺</div>
            <div class="category-name">${cat.category_name}</div>
        </div>
    `).join('');
}

async function selectCategory(id, name) {
    currentCategory = { id, name };
    showLoading();
    try {
        const res = await fetch(`${API}/api/live/category/${id}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load');
        channels = data.channels || [];
        if (channels.length === 0) throw new Error('No channels in this category');
        renderChannels();
        showChannelsSection(name);
    } catch (e) {
        showError(e.message);
    }
}

function renderChannels() {
    channelsGrid.innerHTML = channels.map(ch => `
        <div class="channel-card" onclick="playChannel(${ch.id})">
            <div class="channel-poster">
                <img src="${ch.icon || '/placeholder.jpg'}" alt="${escapeHtml(ch.name)}" onerror="this.src='/placeholder.jpg'">
                <div class="live-badge">LIVE</div>
            </div>
            <div class="channel-info">
                <div class="channel-name">${ch.name}</div>
            </div>
        </div>
    `).join('');
}

function playChannel(id) {
    const channel = channels.find(c => c.id === id);
    if (channel) {
        sessionStorage.setItem('currentChannel', JSON.stringify({
            id: channel.id,
            name: channel.name,
            icon: channel.icon
        }));
    }
    window.location.href = `/player?id=${id}&type=live`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function showCategories() {
    channelsSection.style.display = 'none';
    categoriesSection.style.display = 'block';
}

function showCategoriesSection() {
    loading.style.display = 'none';
    error.style.display = 'none';
    categoriesSection.style.display = 'block';
}

function showChannelsSection(name) {
    categoryTitle.textContent = name;
    loading.style.display = 'none';
    error.style.display = 'none';
    categoriesSection.style.display = 'none';
    channelsSection.style.display = 'block';
}

function showLoading() {
    loading.style.display = 'flex';
    error.style.display = 'none';
    categoriesSection.style.display = 'none';
    channelsSection.style.display = 'none';
}

function showError(msg) {
    errorMsg.textContent = msg;
    loading.style.display = 'none';
    error.style.display = 'flex';
}

function retry() {
    if (currentCategory) selectCategory(currentCategory.id, currentCategory.name);
    else loadCategories();
}

window.selectCategory = selectCategory;
window.playChannel = playChannel;
window.retry = retry;

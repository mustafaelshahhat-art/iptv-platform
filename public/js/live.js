'use strict';

// ==========================================
// IPTV LIVE TV - Channel Browser
// Production-Ready Frontend Controller
// ==========================================

const API = window.location.origin;

// State
let categories = [];
let channels = [];
let currentCategory = null;
let isLoading = false;

// DOM Elements
let elements = {
    loading: null,
    error: null,
    errorMsg: null,
    categoriesSection: null,
    categoriesGrid: null,
    channelsSection: null,
    channelsGrid: null,
    categoryTitle: null,
    backBtn: null
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    setupEventListeners();
    loadCategories();
});

function cacheElements() {
    elements = {
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        errorMsg: document.getElementById('error-msg'),
        categoriesSection: document.getElementById('categories-section'),
        categoriesGrid: document.getElementById('categories-grid'),
        channelsSection: document.getElementById('channels-section'),
        channelsGrid: document.getElementById('channels-grid'),
        categoryTitle: document.getElementById('category-title'),
        backBtn: document.getElementById('back-btn')
    };
}

function setupEventListeners() {
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', showCategories);
    }
}

// ==========================================
// UTILITIES
// ==========================================

function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, m => map[m] || m);
}

function sanitizeId(id) {
    if (id === null || id === undefined) return null;
    const clean = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    return clean.length > 0 && clean.length <= 50 ? clean : null;
}

function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '/placeholder.jpg';
    // Basic URL validation
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return escapeHtml(url);
    }
    return '/placeholder.jpg';
}

function setDisplay(element, display) {
    if (element && element.style) {
        element.style.display = display;
    }
}

function setText(element, text) {
    if (element) {
        element.textContent = text || '';
    }
}

function setHtml(element, html) {
    if (element) {
        element.innerHTML = html || '';
    }
}

// ==========================================
// API HANDLERS
// ==========================================

async function safeFetch(url, timeout = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Server error (${response.status})`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Invalid response format');
        }

        return await response.json();

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }

        throw error;
    }
}

// ==========================================
// CATEGORIES
// ==========================================

async function loadCategories() {
    if (isLoading) return;
    isLoading = true;

    showLoading();

    try {
        const data = await safeFetch(`${API}/api/live/categories`);

        if (!data.success) {
            throw new Error('Failed to load categories');
        }

        categories = Array.isArray(data.categories) ? data.categories : [];

        if (categories.length === 0) {
            throw new Error('No categories available');
        }

        // Validate category data
        categories = categories.filter(cat =>
            cat && (cat.category_id !== undefined) && cat.category_name
        );

        if (categories.length === 0) {
            throw new Error('No valid categories found');
        }

        renderCategories();
        showCategoriesSection();

    } catch (error) {
        showError(error.message || 'Failed to load categories');
    } finally {
        isLoading = false;
    }
}

function renderCategories() {
    if (!elements.categoriesGrid) return;

    const html = categories.map(cat => {
        const id = sanitizeId(cat.category_id);
        const name = escapeHtml(cat.category_name || 'Unknown');

        if (!id) return '';

        return `
            <div class="category-card" onclick="selectCategory('${id}', '${name.replace(/'/g, "\\'")}')">
                <div class="category-icon">📺</div>
                <div class="category-name">${name}</div>
            </div>
        `;
    }).join('');

    setHtml(elements.categoriesGrid, html);
}

// ==========================================
// CHANNELS
// ==========================================

async function selectCategory(id, name) {
    const cleanId = sanitizeId(id);
    if (!cleanId || isLoading) return;

    isLoading = true;
    currentCategory = { id: cleanId, name: name || 'Unknown' };

    showLoading();

    try {
        const data = await safeFetch(`${API}/api/live/category/${cleanId}`);

        if (!data.success) {
            throw new Error('Failed to load channels');
        }

        channels = Array.isArray(data.channels) ? data.channels : [];

        if (channels.length === 0) {
            throw new Error('No channels in this category');
        }

        // Validate channel data
        channels = channels.filter(ch => ch && ch.id !== undefined);

        if (channels.length === 0) {
            throw new Error('No valid channels found');
        }

        renderChannels();
        showChannelsSection(currentCategory.name);

    } catch (error) {
        showError(error.message || 'Failed to load channels');
    } finally {
        isLoading = false;
    }
}

function renderChannels() {
    if (!elements.channelsGrid) return;

    const html = channels.map(ch => {
        const id = ch.id;
        const name = escapeHtml(ch.name || 'Unknown Channel');
        const icon = sanitizeUrl(ch.icon);

        if (id === undefined || id === null) return '';

        return `
            <div class="channel-card" onclick="playChannel(${Number(id)})">
                <div class="channel-poster">
                    <img src="${icon}" 
                         alt="${name}" 
                         onerror="this.onerror=null;this.src='/placeholder.jpg'"
                         loading="lazy">
                    <div class="live-badge">LIVE</div>
                </div>
                <div class="channel-info">
                    <div class="channel-name">${name}</div>
                </div>
            </div>
        `;
    }).join('');

    setHtml(elements.channelsGrid, html);
}

// ==========================================
// PLAYBACK
// ==========================================

function playChannel(id) {
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
        showError('Invalid channel');
        return;
    }

    // Direct stream via Backend Redirect (Handles AUTH & HTTPS->HTTP)
    const streamUrl = `${API}/stream/live/${numericId}`;

    // Open in new tab to bypass Vercel/Browser Mixed Content restrictions
    window.open(streamUrl, '_blank');
}

// ==========================================
// UI STATE MANAGEMENT
// ==========================================

function showLoading() {
    setDisplay(elements.loading, 'flex');
    setDisplay(elements.error, 'none');
    setDisplay(elements.categoriesSection, 'none');
    setDisplay(elements.channelsSection, 'none');
}

function showError(msg) {
    setText(elements.errorMsg, msg || 'An error occurred');
    setDisplay(elements.loading, 'none');
    setDisplay(elements.error, 'flex');
    setDisplay(elements.categoriesSection, 'none');
    setDisplay(elements.channelsSection, 'none');
}

function showCategoriesSection() {
    setDisplay(elements.loading, 'none');
    setDisplay(elements.error, 'none');
    setDisplay(elements.categoriesSection, 'block');
    setDisplay(elements.channelsSection, 'none');
}

function showChannelsSection(name) {
    setText(elements.categoryTitle, name || 'Channels');
    setDisplay(elements.loading, 'none');
    setDisplay(elements.error, 'none');
    setDisplay(elements.categoriesSection, 'none');
    setDisplay(elements.channelsSection, 'block');
}

function showCategories() {
    currentCategory = null;
    channels = [];
    setDisplay(elements.channelsSection, 'none');
    setDisplay(elements.categoriesSection, 'block');
}

// ==========================================
// RETRY
// ==========================================

function retry() {
    if (currentCategory && currentCategory.id) {
        selectCategory(currentCategory.id, currentCategory.name);
    } else {
        loadCategories();
    }
}

// ==========================================
// GLOBAL EXPORTS
// ==========================================

window.selectCategory = selectCategory;
window.playChannel = playChannel;
window.retry = retry;

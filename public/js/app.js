const API_BASE = window.location.origin;

let currentSection = null;
let currentCategory = null;
let categoriesCache = {};
let contentCache = {};
let isLoading = false;

const welcomeState = document.getElementById('welcome-state');
const loadingState = document.getElementById('loading-state');
const loadingText = document.getElementById('loading-text');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const categoriesSection = document.getElementById('categories-section');
const categoriesGrid = document.getElementById('categories-grid');
const categoriesTitle = document.getElementById('categories-title');
const categoryCount = document.getElementById('category-count');
const contentSection = document.getElementById('content-section');
const contentGrid = document.getElementById('content-grid');
const contentTitle = document.getElementById('content-title');
const contentCount = document.getElementById('content-count');
const contentType = document.getElementById('content-type');

const CATEGORY_ICONS = { 'action': '💥', 'comedy': '😂', 'drama': '🎭', 'horror': '👻', 'thriller': '🔪', 'romance': '💕', 'sci-fi': '🚀', 'fantasy': '🧙', 'animation': '🎨', 'documentary': '📽️', 'adventure': '🗺️', 'crime': '🕵️', 'family': '👨‍👩‍👧‍👦', 'mystery': '🔍', 'war': '⚔️', 'western': '🤠', 'musical': '🎵', 'sport': '⚽', 'news': '📰', 'kids': '🧸', 'entertainment': '🎪' };

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-link, .welcome-btn').forEach(btn => {
        btn.addEventListener('click', () => selectSection(btn.dataset.section));
    });
});

function selectSection(section) {
    currentSection = section;
    currentCategory = null;
    loadCategories(section);
}

async function loadCategories(section) {
    if (isLoading) return;
    isLoading = true;
    showLoading(`Loading ${section} categories...`);

    try {
        if (categoriesCache[section]) {
            renderCategories(categoriesCache[section], section);
            showCategories(section);
            isLoading = false;
            return;
        }

        const endpoint = section === 'movies' ? '/api/movies/categories' : section === 'series' ? '/api/series/categories' : '/api/live/categories';
        const response = await fetch(`${API_BASE}${endpoint}`);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to fetch categories');

        categoriesCache[section] = data.categories || [];
        renderCategories(categoriesCache[section], section);
        showCategories(section);
    } catch (error) {
        console.error('Error loading categories:', error);
        showError(`Failed to load ${section} categories: ${error.message}`);
    } finally {
        isLoading = false;
    }
}

async function loadContent(section, categoryId, categoryName) {
    if (isLoading) return;
    isLoading = true;
    currentCategory = { id: categoryId, name: categoryName, section };
    showLoading(`Loading ${categoryName}...`);

    try {
        const cacheKey = `${section}_${categoryId}`;
        if (contentCache[cacheKey]) {
            renderContent(contentCache[cacheKey], section);
            showContent(categoryName, section);
            isLoading = false;
            return;
        }

        const endpoint = section === 'movies' ? `/api/movies/category/${categoryId}` : section === 'series' ? `/api/series/category/${categoryId}` : `/api/live/category/${categoryId}`;
        const response = await fetch(`${API_BASE}${endpoint}`);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to fetch content');

        const content = data.movies || data.series || data.channels || [];
        contentCache[cacheKey] = content;
        renderContent(content, section);
        showContent(categoryName, section);
    } catch (error) {
        console.error('Error loading content:', error);
        showError(`Failed to load content: ${error.message}`);
    } finally {
        isLoading = false;
    }
}

function renderCategories(categories, section) {
    categoriesGrid.innerHTML = '';
    categories.forEach((cat, i) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.style.setProperty('--index', i);
        card.onclick = () => loadContent(section, cat.category_id, cat.category_name);
        card.innerHTML = `<div class="category-icon">${getCategoryIcon(cat.category_name)}</div><div class="category-name">${cat.category_name}</div>`;
        categoriesGrid.appendChild(card);
    });
    categoryCount.textContent = categories.length;
}

function renderContent(items, section) {
    contentGrid.innerHTML = '';
    contentGrid.className = section === 'live' ? 'channels-grid' : 'content-grid';

    items.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = section === 'live' ? 'channel-card' : 'content-card';
        card.style.setProperty('--index', i);

        if (section === 'live') {
            card.onclick = () => playLive(item);
            card.innerHTML = `<div class="channel-poster"><img src="${item.icon}" alt="${item.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>📡</div>'"><div class="live-badge">LIVE</div></div><div class="channel-info"><div class="channel-name">${item.name}</div></div>`;
        } else {
            card.onclick = () => section === 'series' ? viewSeries(item) : playMovie(item);
            card.innerHTML = `<div class="content-poster"><img src="${item.icon}" alt="${item.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>'"></div><div class="content-info"><div class="content-name">${item.name}</div><div class="content-meta">${item.year !== 'N/A' ? `<span>${item.year}</span>` : ''}${item.rating !== 'N/A' ? `<span class="rating">★ ${item.rating}</span>` : ''}</div></div>`;
        }
        contentGrid.appendChild(card);
    });
    contentCount.textContent = items.length;
}

function getCategoryIcon(name) {
    const n = name.toLowerCase();
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
        if (n.includes(key)) return icon;
    }
    return '🎬';
}

function playMovie(movie) {
    sessionStorage.setItem('currentMovie', JSON.stringify(movie));
    window.location.href = `/player?id=${movie.id}&ext=${movie.extension}&type=movie`;
}

function viewSeries(series) {
    sessionStorage.setItem('currentSeries', JSON.stringify(series));
    window.location.href = `/series?id=${series.id}`;
}

function playLive(channel) {
    sessionStorage.setItem('currentChannel', JSON.stringify(channel));
    window.location.href = `/player?id=${channel.id}&type=live`;
}

function backToCategories() {
    if (currentSection) {
        showCategories(currentSection);
    } else {
        showWelcome();
    }
}

function showWelcome() {
    welcomeState.style.display = 'flex';
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    categoriesSection.style.display = 'none';
    contentSection.style.display = 'none';
}

function showLoading(message) {
    loadingText.textContent = message;
    welcomeState.style.display = 'none';
    loadingState.style.display = 'flex';
    errorState.style.display = 'none';
    categoriesSection.style.display = 'none';
    contentSection.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    welcomeState.style.display = 'none';
    loadingState.style.display = 'none';
    errorState.style.display = 'flex';
    categoriesSection.style.display = 'none';
    contentSection.style.display = 'none';
}

function showCategories(section) {
    const titles = { movies: 'Movie Categories', series: 'Series Categories', live: 'Live TV Categories' };
    categoriesTitle.textContent = titles[section] || 'Categories';
    welcomeState.style.display = 'none';
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    categoriesSection.style.display = 'block';
    contentSection.style.display = 'none';
}

function showContent(categoryName, section) {
    const types = { movies: 'movies', series: 'series', live: 'channels' };
    contentTitle.textContent = categoryName;
    contentType.textContent = types[section] || 'items';
    welcomeState.style.display = 'none';
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    categoriesSection.style.display = 'none';
    contentSection.style.display = 'block';
}

function retryLoad() {
    if (currentCategory) {
        loadContent(currentCategory.section, currentCategory.id, currentCategory.name);
    } else if (currentSection) {
        loadCategories(currentSection);
    } else {
        showWelcome();
    }
}

window.backToCategories = backToCategories;
window.retryLoad = retryLoad;

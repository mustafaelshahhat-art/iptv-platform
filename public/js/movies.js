const API = window.location.origin;
let categories = [];
let movies = [];
let currentCategory = null;

const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMsg = document.getElementById('error-msg');
const categoriesSection = document.getElementById('categories-section');
const categoriesGrid = document.getElementById('categories-grid');
const moviesSection = document.getElementById('movies-section');
const moviesGrid = document.getElementById('movies-grid');
const categoryTitle = document.getElementById('category-title');
const backBtn = document.getElementById('back-btn');

document.addEventListener('DOMContentLoaded', loadCategories);
backBtn.addEventListener('click', showCategories);

async function loadCategories() {
    showLoading();
    try {
        const res = await fetch(`${API}/api/movies/categories`);
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
            <div class="category-icon">🎬</div>
            <div class="category-name">${cat.category_name}</div>
        </div>
    `).join('');
}

async function selectCategory(id, name) {
    currentCategory = { id, name };
    showLoading();
    try {
        const res = await fetch(`${API}/api/movies/category/${id}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load');
        movies = data.movies || [];
        if (movies.length === 0) throw new Error('No movies in this category');
        renderMovies();
        showMoviesSection(name);
    } catch (e) {
        showError(e.message);
    }
}

function renderMovies() {
    moviesGrid.innerHTML = movies.map(m => `
        <div class="content-card" onclick="playMovie(${m.id}, '${m.extension || 'mp4'}')">
            <div class="content-poster">
                <img src="${m.icon || '/placeholder.jpg'}" alt="${escapeHtml(m.name)}" onerror="this.src='/placeholder.jpg'">
            </div>
            <div class="content-info">
                <div class="content-name">${m.name}</div>
                <div class="content-meta">
                    ${m.rating && m.rating !== 'N/A' ? `<span class="rating">★ ${m.rating}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function playMovie(id, ext) {
    if (!id) return;
    const streamUrl = `${API}/stream/${id}?ext=${ext || 'mp4'}`;
    window.open(streamUrl, '_blank');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function showCategories() {
    moviesSection.style.display = 'none';
    categoriesSection.style.display = 'block';
}

function showCategoriesSection() {
    loading.style.display = 'none';
    error.style.display = 'none';
    categoriesSection.style.display = 'block';
}

function showMoviesSection(name) {
    categoryTitle.textContent = name;
    loading.style.display = 'none';
    error.style.display = 'none';
    categoriesSection.style.display = 'none';
    moviesSection.style.display = 'block';
}

function showLoading() {
    loading.style.display = 'flex';
    error.style.display = 'none';
    categoriesSection.style.display = 'none';
    moviesSection.style.display = 'none';
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
window.playMovie = playMovie;
window.retry = retry;

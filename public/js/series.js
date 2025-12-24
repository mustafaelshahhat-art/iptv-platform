const API = window.location.origin;
let categories = [];
let seriesList = [];
let seriesData = null;
let currentCategory = null;
let currentSeason = null;

const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMsg = document.getElementById('error-msg');
const categoriesSection = document.getElementById('categories-section');
const categoriesGrid = document.getElementById('categories-grid');
const seriesListSection = document.getElementById('series-list-section');
const seriesGrid = document.getElementById('series-grid');
const categoryTitle = document.getElementById('category-title');
const seriesDetailSection = document.getElementById('series-detail-section');
const seriesPoster = document.getElementById('series-poster');
const seriesTitle = document.getElementById('series-title');
const seriesYear = document.getElementById('series-year');
const seriesRating = document.getElementById('series-rating');
const seriesPlot = document.getElementById('series-plot');
const seasonSelect = document.getElementById('season-select');
const episodesGrid = document.getElementById('episodes-grid');

document.getElementById('back-to-cats').addEventListener('click', showCategories);
document.getElementById('back-to-list').addEventListener('click', showSeriesList);
seasonSelect.addEventListener('change', (e) => displayEpisodes(e.target.value));

document.addEventListener('DOMContentLoaded', loadCategories);

async function loadCategories() {
    showLoading();
    try {
        const res = await fetch(`${API}/api/series/categories`);
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
        const res = await fetch(`${API}/api/series/category/${id}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load');
        seriesList = data.series || [];
        if (seriesList.length === 0) throw new Error('No series in this category');
        renderSeriesList();
        showSeriesListSection(name);
    } catch (e) {
        showError(e.message);
    }
}

function renderSeriesList() {
    seriesGrid.innerHTML = seriesList.map(s => `
        <div class="content-card" onclick="viewSeries(${s.id})">
            <div class="content-poster">
                <img src="${s.icon || '/placeholder.jpg'}" alt="${escapeHtml(s.name)}" onerror="this.src='/placeholder.jpg'">
            </div>
            <div class="content-info">
                <div class="content-name">${s.name}</div>
                <div class="content-meta">${s.rating && s.rating !== 'N/A' ? `<span class="rating">★ ${s.rating}</span>` : ''}</div>
            </div>
        </div>
    `).join('');
}

async function viewSeries(id) {
    showLoading();
    try {
        const res = await fetch(`${API}/api/series/${id}/info`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load');
        seriesData = data.data;
        if (!seriesData) throw new Error('Series data not found');
        displaySeriesDetail();
        showSeriesDetailSection();
    } catch (e) {
        showError(e.message);
    }
}

function displaySeriesDetail() {
    const info = seriesData.info || {};
    seriesPoster.src = info.cover || '/placeholder.jpg';
    seriesTitle.textContent = info.name || 'Unknown';
    seriesYear.textContent = info.releaseDate || '';
    seriesRating.textContent = info.rating ? `★ ${info.rating}` : '';
    seriesPlot.textContent = info.plot || '';

    const episodes = seriesData.episodes || {};
    const seasons = Object.keys(episodes).sort((a, b) => parseInt(a) - parseInt(b));

    if (seasons.length === 0) {
        seasonSelect.innerHTML = '<option>No seasons</option>';
        episodesGrid.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">No episodes available</p>';
        return;
    }

    seasonSelect.innerHTML = seasons.map(s => `<option value="${s}">Season ${s}</option>`).join('');
    currentSeason = seasons[0];
    displayEpisodes(currentSeason);
}

function displayEpisodes(seasonNum) {
    currentSeason = seasonNum;
    const episodes = seriesData.episodes?.[seasonNum] || [];

    if (episodes.length === 0) {
        episodesGrid.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">No episodes available</p>';
        return;
    }

    episodesGrid.innerHTML = episodes.map(ep => `
        <div class="episode-card" onclick="playEpisode(${ep.id}, '${ep.container_extension || 'mp4'}', ${seasonNum}, ${ep.episode_num})">
            <div class="episode-thumb"><span class="episode-num">E${ep.episode_num}</span><span class="episode-play">▶</span></div>
            <div class="episode-title">${ep.title || 'Episode ' + ep.episode_num}</div>
        </div>
    `).join('');
}

function playEpisode(id, ext, season, epNum) {
    sessionStorage.setItem('currentEpisode', JSON.stringify({
        id, name: `${seriesData.info?.name || 'Series'} - S${season}E${epNum}`,
        season, episode: epNum
    }));
    window.location.href = `/player?id=${id}&ext=${ext}&type=series`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function showCategories() {
    seriesListSection.style.display = 'none';
    seriesDetailSection.style.display = 'none';
    categoriesSection.style.display = 'block';
}

function showSeriesList() {
    seriesDetailSection.style.display = 'none';
    seriesListSection.style.display = 'block';
}

function showCategoriesSection() {
    loading.style.display = 'none';
    error.style.display = 'none';
    categoriesSection.style.display = 'block';
}

function showSeriesListSection(name) {
    categoryTitle.textContent = name;
    loading.style.display = 'none';
    error.style.display = 'none';
    categoriesSection.style.display = 'none';
    seriesListSection.style.display = 'block';
}

function showSeriesDetailSection() {
    loading.style.display = 'none';
    error.style.display = 'none';
    seriesListSection.style.display = 'none';
    seriesDetailSection.style.display = 'block';
}

function showLoading() {
    loading.style.display = 'flex';
    error.style.display = 'none';
    categoriesSection.style.display = 'none';
    seriesListSection.style.display = 'none';
    seriesDetailSection.style.display = 'none';
}

function showError(msg) {
    errorMsg.textContent = msg;
    loading.style.display = 'none';
    error.style.display = 'flex';
}

function retry() {
    loadCategories();
}

window.selectCategory = selectCategory;
window.viewSeries = viewSeries;
window.playEpisode = playEpisode;
window.retry = retry;

'use strict';

// ==========================================
// IPTV VOD STREAMING API
// Vercel Serverless Function
// ==========================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// ==========================================
// CONFIGURATION
// ==========================================

const IPTV_CONFIG = {
    serverUrl: (process.env.IPTV_SERVER_URL || '').replace(/\/+$/, ''),
    username: process.env.IPTV_USERNAME,
    password: process.env.IPTV_PASSWORD
};

const isConfigValid = IPTV_CONFIG.serverUrl && IPTV_CONFIG.username && IPTV_CONFIG.password;

// ==========================================
// MIDDLEWARE
// ==========================================

app.disable('x-powered-by');
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
    const blocked = ['.env', '.git', 'node_modules', 'package.json'];
    if (req.path && typeof req.path === 'string' && blocked.some(b => req.path.toLowerCase().includes(b))) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
});

// ==========================================
// HELPERS
// ==========================================

function sanitizeId(id) {
    if (!id) return null;
    const clean = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    return clean.length > 0 && clean.length <= 50 ? clean : null;
}

function sanitizeExtension(ext) {
    const allowed = ['mp4', 'mkv', 'avi', 'm3u8', 'ts'];
    const clean = String(ext || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    return allowed.includes(clean) ? clean : 'mp4';
}

function buildApiUrl(action, params = {}) {
    const url = new URL(`${IPTV_CONFIG.serverUrl}/player_api.php`);
    url.searchParams.set('username', IPTV_CONFIG.username);
    url.searchParams.set('password', IPTV_CONFIG.password);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    return url.toString();
}

function buildMovieUrl(streamId, extension = 'mp4') {
    return `${IPTV_CONFIG.serverUrl}/movie/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${streamId}.${extension}`;
}

function buildSeriesUrl(episodeId, extension = 'mp4') {
    return `${IPTV_CONFIG.serverUrl}/series/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${episodeId}.${extension}`;
}

function sendError(res, status, message) {
    if (!res.headersSent) res.status(status).json({ success: false, error: message });
}

const axiosDefaults = { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } };

// ==========================================
// DATA ROUTES (Categories/Lists)
// ==========================================

app.get('/api/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_vod_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/movies/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_vod_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/movies', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_vod_streams'), { ...axiosDefaults, timeout: 20000 });
        const movies = (response.data || []).map(m => ({
            id: m.stream_id,
            name: m.name,
            icon: m.stream_icon,
            extension: m.container_extension || 'mp4',
            rating: m.rating,
            year: m.releasedate,
            category: m.category_id
        }));
        res.json({ success: true, count: movies.length, movies });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/movies/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    try {
        const response = await axios.get(buildApiUrl('get_vod_streams', { category_id: categoryId }), { ...axiosDefaults, timeout: 20000 });
        const movies = (response.data || []).map(m => ({
            id: m.stream_id,
            name: m.name,
            icon: m.stream_icon,
            extension: m.container_extension || 'mp4',
            rating: m.rating,
            year: m.releasedate,
            category: m.category_id
        }));
        res.json({ success: true, count: movies.length, movies });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/movie/:id', async (req, res) => {
    const movieId = sanitizeId(req.params.id);
    try {
        const response = await axios.get(buildApiUrl('get_vod_info', { vod_id: movieId }), axiosDefaults);
        res.json({ success: true, movie: response.data });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/series/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_series_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/series/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    try {
        const response = await axios.get(buildApiUrl('get_series', { category_id: categoryId }), { ...axiosDefaults, timeout: 20000 });
        const series = (response.data || []).map(s => ({
            id: s.series_id,
            name: s.name,
            icon: s.cover,
            rating: s.rating,
            year: s.releaseDate,
            category: s.category_id
        }));
        res.json({ success: true, count: series.length, series });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/series/:id/info', async (req, res) => {
    const seriesId = sanitizeId(req.params.id);
    try {
        const response = await axios.get(buildApiUrl('get_series_info', { series_id: seriesId }), axiosDefaults);
        res.json({ success: true, data: response.data });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/live/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_live_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

app.get('/api/live/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    try {
        const response = await axios.get(buildApiUrl('get_live_streams', { category_id: categoryId }), { ...axiosDefaults, timeout: 20000 });
        const channels = (response.data || []).map(ch => ({
            id: ch.stream_id,
            name: ch.name,
            icon: ch.stream_icon,
            category: ch.category_id
        }));
        res.json({ success: true, count: channels.length, channels });
    } catch (error) { sendError(res, 500, 'Failed'); }
});

// ==========================================
// STREAMING - ALL REDIRECT (Direct & Fast)
// ==========================================

// Movies - Redirect
app.get('/stream/:id(\\d+)', (req, res) => {
    const streamId = sanitizeId(req.params.id);
    const extension = sanitizeExtension(req.query.ext);
    if (!streamId) return sendError(res, 400, 'ID required');

    // Redirect 302 to original HTTP URL
    res.redirect(buildMovieUrl(streamId, extension));
});

// Series - Redirect
app.get('/stream/series/:id/:extension', (req, res) => {
    const episodeId = sanitizeId(req.params.id);
    const extension = sanitizeExtension(req.params.extension);
    if (!episodeId) return sendError(res, 400, 'ID required');

    // Redirect 302 to original HTTP URL
    res.redirect(buildSeriesUrl(episodeId, extension));
});

// Live TV - Redirect
app.get('/stream/live/:id(\\d+)', (req, res) => {
    const streamId = sanitizeId(req.params.id);
    if (!streamId) return sendError(res, 400, 'ID required');

    const baseUrl = new URL(IPTV_CONFIG.serverUrl);
    baseUrl.port = '8080';
    const liveUrl = `${baseUrl.origin}/live/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${streamId}.m3u8`;

    res.redirect(liveUrl);
});

// ==========================================
// UTILITY
// ==========================================

app.get('/api/health', (req, res) => res.json({ status: 'healthy', mode: 'Pure Redirect' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal Server Error' }));

module.exports = app;

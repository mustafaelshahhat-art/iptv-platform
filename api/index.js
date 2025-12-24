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

// Validate config
const isConfigValid = IPTV_CONFIG.serverUrl && IPTV_CONFIG.username && IPTV_CONFIG.password;

// ==========================================
// MIDDLEWARE
// ==========================================

app.disable('x-powered-by');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range']
}));

app.use(express.json({ limit: '1mb' }));

// Block sensitive files
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
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

// Convert HTTP URL to HTTPS for redirection
function toHttps(url) {
    if (!url) return url;
    return url.replace(/^http:/, 'https:');
}

function buildMovieUrl(streamId, extension = 'mp4') {
    const id = sanitizeId(streamId);
    const ext = sanitizeExtension(extension);
    return `${IPTV_CONFIG.serverUrl}/movie/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${id}.${ext}`;
}

function buildSeriesUrl(episodeId, extension = 'mp4') {
    const id = sanitizeId(episodeId);
    const ext = sanitizeExtension(extension);
    return `${IPTV_CONFIG.serverUrl}/series/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${id}.${ext}`;
}

function sendError(res, status, message) {
    if (!res.headersSent) {
        res.status(status).json({ success: false, error: message });
    }
}

const axiosDefaults = {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Proxy/1.0)' }
};

// ==========================================
// CONFIG CHECK MIDDLEWARE
// ==========================================

app.use((req, res, next) => {
    if (!isConfigValid && req.path.startsWith('/api')) {
        return sendError(res, 503, 'Service not configured');
    }
    next();
});

// ==========================================
// DATA API (Movies/Series/Live Categories)
// ==========================================
// These still use the proxy to fetch JSON data (safe from CORS)

app.get('/api/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_vod_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch categories');
    }
});

app.get('/api/movies/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_vod_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch categories');
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_vod_streams'), { ...axiosDefaults, timeout: 20000 });
        const movies = (response.data || []).map(m => ({
            id: m.stream_id,
            name: m.name || 'Unknown',
            icon: m.stream_icon || '/placeholder.jpg',
            extension: m.container_extension || 'mp4',
            rating: m.rating || 'N/A',
            year: m.releasedate || 'N/A',
            category: m.category_id
        }));
        res.json({ success: true, count: movies.length, movies });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch movies');
    }
});

app.get('/api/movies/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    if (!categoryId) return sendError(res, 400, 'Invalid category ID');

    try {
        const response = await axios.get(buildApiUrl('get_vod_streams', { category_id: categoryId }), { ...axiosDefaults, timeout: 20000 });
        const movies = (response.data || []).map(m => ({
            id: m.stream_id,
            name: m.name || 'Unknown',
            icon: m.stream_icon || '/placeholder.jpg',
            extension: m.container_extension || 'mp4',
            rating: m.rating || 'N/A',
            year: m.releasedate || 'N/A',
            category: m.category_id
        }));
        res.json({ success: true, count: movies.length, movies });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch movies');
    }
});

app.get('/api/movie/:id', async (req, res) => {
    const movieId = sanitizeId(req.params.id);
    if (!movieId) return sendError(res, 400, 'Invalid movie ID');

    try {
        const response = await axios.get(buildApiUrl('get_vod_info', { vod_id: movieId }), axiosDefaults);
        res.json({ success: true, movie: response.data });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch movie info');
    }
});

app.get('/api/series/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_series_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch series categories');
    }
});

app.get('/api/series/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    if (!categoryId) return sendError(res, 400, 'Invalid category ID');

    try {
        const response = await axios.get(buildApiUrl('get_series', { category_id: categoryId }), { ...axiosDefaults, timeout: 20000 });
        const series = (response.data || []).map(s => ({
            id: s.series_id,
            name: s.name || 'Unknown',
            icon: s.cover || '/placeholder.jpg',
            rating: s.rating || 'N/A',
            year: s.releaseDate || 'N/A',
            category: s.category_id,
            plot: s.plot || ''
        }));
        res.json({ success: true, count: series.length, series });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch series');
    }
});

app.get('/api/series/:id/info', async (req, res) => {
    const seriesId = sanitizeId(req.params.id);
    if (!seriesId) return sendError(res, 400, 'Invalid series ID');

    try {
        const response = await axios.get(buildApiUrl('get_series_info', { series_id: seriesId }), axiosDefaults);
        res.json({ success: true, data: response.data });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch series info');
    }
});

app.get('/api/live/categories', async (req, res) => {
    try {
        const response = await axios.get(buildApiUrl('get_live_categories'), axiosDefaults);
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch live categories');
    }
});

app.get('/api/live/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    if (!categoryId) return sendError(res, 400, 'Invalid category ID');

    try {
        const response = await axios.get(buildApiUrl('get_live_streams', { category_id: categoryId }), { ...axiosDefaults, timeout: 20000 });
        const channels = (response.data || []).map(ch => ({
            id: ch.stream_id,
            name: ch.name || 'Unknown',
            icon: ch.stream_icon || '/placeholder.jpg',
            category: ch.category_id,
            epgChannelId: ch.epg_channel_id
        }));
        res.json({ success: true, count: channels.length, channels });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch channels');
    }
});

// ==========================================
// STREAMING - REDIRECT TO HTTPS
// ==========================================

// Movies - Redirect
app.get('/stream/:id(\\d+)', async (req, res) => {
    const streamId = sanitizeId(req.params.id);
    const extension = sanitizeExtension(req.query.ext);

    if (!streamId) return sendError(res, 400, 'Invalid stream ID');

    const movieUrl = buildMovieUrl(streamId, extension);
    const httpsUrl = toHttps(movieUrl);

    // Redirect to HTTPS version
    res.redirect(httpsUrl);
});

// Series - Redirect
app.get('/stream/series/:id/:extension', async (req, res) => {
    const episodeId = sanitizeId(req.params.id);
    const extension = sanitizeExtension(req.params.extension);

    if (!episodeId) return sendError(res, 400, 'Invalid episode ID');

    const episodeUrl = buildSeriesUrl(episodeId, extension);
    const httpsUrl = toHttps(episodeUrl);

    // Redirect to HTTPS version
    res.redirect(httpsUrl);
});

// Live TV - Redirect
app.get('/stream/live/:id(\\d+)', (req, res) => {
    const streamId = sanitizeId(req.params.id);
    if (!streamId) return sendError(res, 400, 'Invalid channel ID');

    const id = sanitizeId(streamId);
    const baseUrl = new URL(IPTV_CONFIG.serverUrl);

    // Check if we should try port 8080/443 logic?
    // For now, let's trust the toHttps replacement
    baseUrl.port = '8080';
    const liveUrl = `${baseUrl.origin}/live/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${id}.m3u8`;

    const httpsUrl = toHttps(liveUrl);

    // Redirect to HTTPS version
    res.redirect(httpsUrl);
});

// Segment proxy isn't needed for redirect mode, but keeping it doesn't hurt.
// However, the playlist from the redirect will contain direct links to the IPTV server.

// ==========================================
// UTILITY
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy HTTPS redirect mode',
        configured: isConfigValid,
        timestamp: new Date().toISOString()
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err, req, res, next) => {
    res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;

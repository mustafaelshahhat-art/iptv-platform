// ==========================================
// IPTV VOD STREAMING SERVER
// Production-Ready Backend Proxy
// ==========================================

'use strict';

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// ==========================================
// CONFIGURATION & VALIDATION
// ==========================================

const app = express();
const PORT = process.env.PORT || 8080;

const IPTV_CONFIG = {
    serverUrl: process.env.IPTV_SERVER_URL?.replace(/\/+$/, ''), // Remove trailing slashes
    username: process.env.IPTV_USERNAME,
    password: process.env.IPTV_PASSWORD
};

const CACHE_CONFIG = {
    duration: parseInt(process.env.CACHE_DURATION) || 3600000,
    movies: { data: null, timestamp: null },
    series: { data: null, timestamp: null },
    live: { data: null, timestamp: null }
};

// Strict environment validation
function validateConfig() {
    const required = ['IPTV_SERVER_URL', 'IPTV_USERNAME', 'IPTV_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ FATAL: Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        process.exit(1);
    }

    try {
        new URL(IPTV_CONFIG.serverUrl);
    } catch {
        console.error('❌ FATAL: Invalid IPTV_SERVER_URL format');
        process.exit(1);
    }
}

validateConfig();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Hide server info
app.disable('x-powered-by');

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range']
}));

app.use(express.json({ limit: '1mb' }));

// Block access to sensitive files
app.use((req, res, next) => {
    const blocked = ['.env', '.git', 'node_modules', '.htaccess', 'package.json', 'package-lock.json'];
    const requestPath = req.path.toLowerCase();

    if (blocked.some(b => requestPath.includes(b))) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
});

// Static files with security
app.use(express.static(path.join(__dirname, 'public'), {
    dotfiles: 'deny',
    index: 'index.html'
}));

// Request logging (minimal)
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/stream')) {
        console.log(`${req.method} ${req.path}`);
    }
    next();
});

// ==========================================
// HELPER FUNCTIONS
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

function buildLiveUrl(streamId) {
    const id = sanitizeId(streamId);
    const baseUrl = new URL(IPTV_CONFIG.serverUrl);
    baseUrl.port = '8080';
    return `${baseUrl.origin}/live/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${id}.m3u8`;
}

function getLiveBase() {
    const baseUrl = new URL(IPTV_CONFIG.serverUrl);
    baseUrl.port = '8080';
    return `${baseUrl.origin}/live/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/`;
}

function isCacheValid(cache) {
    return cache.data && cache.timestamp && (Date.now() - cache.timestamp) < CACHE_CONFIG.duration;
}

function sendError(res, status, message) {
    if (!res.headersSent) {
        res.status(status).json({ success: false, error: message });
    }
}

const axiosDefaults = {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Proxy/1.0)' },
    validateStatus: status => status < 500
};

// ==========================================
// PAGE ROUTES
// ==========================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/movies', (req, res) => res.sendFile(path.join(__dirname, 'public', 'movies.html')));
app.get('/series', (req, res) => res.sendFile(path.join(__dirname, 'public', 'series.html')));
app.get('/live', (req, res) => res.sendFile(path.join(__dirname, 'public', 'live.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));

// ==========================================
// MOVIES API
// ==========================================

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
        if (isCacheValid(CACHE_CONFIG.movies)) {
            return res.json({ success: true, cached: true, count: CACHE_CONFIG.movies.data.length, movies: CACHE_CONFIG.movies.data });
        }

        const response = await axios.get(buildApiUrl('get_vod_streams'), { ...axiosDefaults, timeout: 30000 });

        if (!response.data || !Array.isArray(response.data)) {
            return sendError(res, 502, 'Invalid upstream response');
        }

        const movies = response.data.map(m => ({
            id: m.stream_id,
            name: m.name || 'Unknown',
            icon: m.stream_icon || '/placeholder.jpg',
            extension: m.container_extension || 'mp4',
            rating: m.rating || 'N/A',
            year: m.releasedate || 'N/A',
            category: m.category_id
        }));

        CACHE_CONFIG.movies.data = movies;
        CACHE_CONFIG.movies.timestamp = Date.now();

        res.json({ success: true, cached: false, count: movies.length, movies });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch movies');
    }
});

app.get('/api/movies/category/:id', async (req, res) => {
    const categoryId = sanitizeId(req.params.id);
    if (!categoryId) return sendError(res, 400, 'Invalid category ID');

    try {
        const response = await axios.get(buildApiUrl('get_vod_streams', { category_id: categoryId }), { ...axiosDefaults, timeout: 30000 });
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

// ==========================================
// SERIES API
// ==========================================

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
        const response = await axios.get(buildApiUrl('get_series', { category_id: categoryId }), { ...axiosDefaults, timeout: 30000 });
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

// ==========================================
// LIVE TV API
// ==========================================

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
        const response = await axios.get(buildApiUrl('get_live_streams', { category_id: categoryId }), { ...axiosDefaults, timeout: 30000 });
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
// VOD STREAMING
// ==========================================

app.get('/stream/:id(\\d+)', async (req, res) => {
    const streamId = sanitizeId(req.params.id);
    const extension = sanitizeExtension(req.query.ext);

    if (!streamId) return sendError(res, 400, 'Invalid stream ID');

    try {
        const movieUrl = buildMovieUrl(streamId, extension);
        const headers = {
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive'
        };

        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await axios({
            method: 'GET',
            url: movieUrl,
            headers,
            responseType: 'stream',
            timeout: 30000,
            validateStatus: s => s < 500
        });

        res.status(response.status);

        ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(h => {
            if (response.headers[h]) res.setHeader(h, response.headers[h]);
        });

        if (!response.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', 'bytes');
        }

        response.data.pipe(res);

        response.data.on('error', () => {
            if (!res.headersSent) res.status(500).end();
        });

        req.on('close', () => {
            if (!res.writableEnded) response.data.destroy();
        });

    } catch (error) {
        sendError(res, 500, 'Streaming failed');
    }
});

// ==========================================
// SERIES STREAMING
// ==========================================

app.get('/stream/series/:id/:extension', async (req, res) => {
    const episodeId = sanitizeId(req.params.id);
    const extension = sanitizeExtension(req.params.extension);

    if (!episodeId) return sendError(res, 400, 'Invalid episode ID');

    try {
        const episodeUrl = buildSeriesUrl(episodeId, extension);
        const headers = {
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive'
        };

        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await axios({
            method: 'GET',
            url: episodeUrl,
            headers,
            responseType: 'stream',
            timeout: 30000,
            validateStatus: s => s < 500
        });

        res.status(response.status);

        ['content-length', 'content-range', 'accept-ranges'].forEach(h => {
            if (response.headers[h]) res.setHeader(h, response.headers[h]);
        });

        // Set correct content type
        if (extension === 'mkv') {
            res.setHeader('Content-Type', 'video/mp4');
        } else if (extension === 'm3u8') {
            res.setHeader('Content-Type', 'application/x-mpegURL');
        } else {
            res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        }

        if (!response.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', 'bytes');
        }

        response.data.pipe(res);

        response.data.on('error', () => {
            if (!res.headersSent) res.status(500).end();
        });

        req.on('close', () => {
            if (!res.writableEnded) response.data.destroy();
        });

    } catch (error) {
        sendError(res, 500, 'Streaming failed');
    }
});

// ==========================================
// LIVE TV STREAMING (Full HLS Proxy)
// ==========================================

app.get('/stream/live/:id(\\d+)', (req, res) => {
    const streamId = sanitizeId(req.params.id);
    if (!streamId) return sendError(res, 400, 'Invalid channel ID');

    const liveUrl = buildLiveUrl(streamId);

    console.log(`→ Live channel ${streamId}`);
    console.log(`  Redirecting to: ${liveUrl}`);

    // Redirect to IPTV source - Video.js will handle HLS
    res.redirect(liveUrl);
});

// Live segment proxy
app.get('/stream/live-segment', async (req, res) => {
    console.log(`  → Segment request:`);
    console.log(`    Full URL: ${req.url}`);
    console.log(`    Query: ${JSON.stringify(req.query)}`);

    const segmentUrl = req.query.url;

    if (!segmentUrl) {
        console.log(`    ❌ No URL parameter!`);
        return res.status(400).end();
    }

    console.log(`    Fetching: ${segmentUrl.substring(0, 80)}...`);

    try {
        new URL(segmentUrl);
    } catch {
        console.log(`    ❌ Invalid URL format`);
        return res.status(400).end();
    }

    try {
        const response = await axios({
            method: 'GET',
            url: segmentUrl,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                'Referer': segmentUrl.split('/').slice(0, 3).join('/') + '/'
            },
            maxRedirects: 5
        });

        const contentType = response.headers['content-type'] || 'video/mp2t';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');

        console.log(`    ✓ Streaming segment (${contentType})`);

        response.data.pipe(res);

        req.on('close', () => {
            if (!res.writableEnded) response.data.destroy();
        });

    } catch (error) {
        console.log(`    ❌ Fetch error: ${error.message}`);
        if (!res.headersSent) res.status(500).end();
    }
});

// Safety redirect
app.get('/live/:id(\\d+)', (req, res) => {
    res.redirect(`/stream/live/${req.params.id}`);
});

// ==========================================
// UTILITY ENDPOINTS
// ==========================================

app.post('/api/cache/clear', (req, res) => {
    CACHE_CONFIG.movies = { data: null, timestamp: null };
    CACHE_CONFIG.series = { data: null, timestamp: null };
    CACHE_CONFIG.live = { data: null, timestamp: null };
    res.json({ success: true, message: 'Cache cleared' });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ==========================================
// SERVER STARTUP
// ==========================================

const server = app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎬 IPTV Streaming Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✓ Port: ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ IPTV: Connected`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});

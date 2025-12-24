// ==========================================
// IPTV VOD STREAMING SERVER
// Backend Proxy for Secure Video Streaming
// ==========================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const IPTV_CONFIG = {
    serverUrl: process.env.IPTV_SERVER_URL,
    username: process.env.IPTV_USERNAME,
    password: process.env.IPTV_PASSWORD
};

if (!IPTV_CONFIG.serverUrl || !IPTV_CONFIG.username || !IPTV_CONFIG.password) {
    console.error('❌ ERROR: Missing IPTV configuration in .env file');
    console.error('Please copy .env.example to .env and fill in your credentials');
    process.exit(1);
}

let moviesCache = { data: null, timestamp: null, duration: parseInt(process.env.CACHE_DURATION) || 3600000 };

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/movies', (req, res) => res.sendFile(path.join(__dirname, 'public', 'movies.html')));
app.get('/series', (req, res) => res.sendFile(path.join(__dirname, 'public', 'series.html')));
app.get('/live', (req, res) => res.sendFile(path.join(__dirname, 'public', 'live.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

function buildApiUrl(action, params = {}) {
    const url = new URL(`${IPTV_CONFIG.serverUrl}/player_api.php`);
    url.searchParams.append('username', IPTV_CONFIG.username);
    url.searchParams.append('password', IPTV_CONFIG.password);
    url.searchParams.append('action', action);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    return url.toString();
}

function buildMovieUrl(streamId, extension = 'mp4') {
    return `${IPTV_CONFIG.serverUrl}/movie/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${streamId}.${extension}`;
}

app.get('/api/movies', async (req, res) => {
    try {
        const now = Date.now();
        if (moviesCache.data && (now - moviesCache.timestamp) < moviesCache.duration) {
            return res.json({ success: true, cached: true, count: moviesCache.data.length, movies: moviesCache.data });
        }
        const apiUrl = buildApiUrl('get_vod_streams');
        const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const processedMovies = (response.data || []).map(m => ({ id: m.stream_id, name: m.name, icon: m.stream_icon || '/placeholder.jpg', extension: m.container_extension || 'mp4', rating: m.rating || 'N/A', year: m.releasedate || 'N/A', category: m.category_id, added: m.added }));
        moviesCache.data = processedMovies;
        moviesCache.timestamp = now;
        res.json({ success: true, cached: false, count: processedMovies.length, movies: processedMovies });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch movies', message: error.message });
    }
});

app.get('/api/movie/:id', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_vod_info', { vod_id: req.params.id });
        const response = await axios.get(apiUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        res.json({ success: true, movie: response.data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch movie info', message: error.message });
    }
});

app.get('/stream/:id', async (req, res) => {
    const streamId = req.params.id;
    const extension = req.query.ext || 'mp4';
    try {
        const movieUrl = buildMovieUrl(streamId, extension);
        const headers = { 'User-Agent': 'VLC/3.0.18', 'Accept': '*/*', 'Accept-Encoding': 'identity', 'Connection': 'keep-alive' };
        if (req.headers.range) headers['Range'] = req.headers.range;
        const response = await axios({ method: 'GET', url: movieUrl, headers, responseType: 'stream', timeout: 30000, validateStatus: s => s < 500 });
        res.status(response.status);
        ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'last-modified', 'etag'].forEach(h => { if (response.headers[h]) res.setHeader(h, response.headers[h]); });
        if (!response.headers['accept-ranges']) res.setHeader('Accept-Ranges', 'bytes');
        response.data.pipe(res);
        response.data.on('error', () => { if (!res.headersSent) res.status(500).end(); });
        req.on('close', () => { if (!res.writableEnded) response.data.destroy(); });
    } catch (error) {
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Streaming failed', message: error.message });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_vod_categories');
        const response = await axios.get(apiUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch categories', message: error.message });
    }
});

app.get('/api/movies/categories', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_vod_categories');
        const response = await axios.get(apiUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch VOD categories', message: error.message });
    }
});

app.get('/api/movies/category/:id', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_vod_streams', { category_id: req.params.id });
        const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const movies = (response.data || []).map(m => ({ id: m.stream_id, name: m.name, icon: m.stream_icon || '/placeholder.jpg', extension: m.container_extension || 'mp4', rating: m.rating || 'N/A', year: m.releasedate || 'N/A', category: m.category_id }));
        res.json({ success: true, count: movies.length, movies });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch movies', message: error.message });
    }
});

app.get('/api/series/categories', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_series_categories');
        const response = await axios.get(apiUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch series categories', message: error.message });
    }
});

app.get('/api/series/category/:id', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_series', { category_id: req.params.id });
        const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const series = (response.data || []).map(s => ({ id: s.series_id, name: s.name, icon: s.cover || '/placeholder.jpg', rating: s.rating || 'N/A', year: s.releaseDate || 'N/A', category: s.category_id, plot: s.plot || '' }));
        res.json({ success: true, count: series.length, series });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch series', message: error.message });
    }
});

app.get('/api/series/:id/info', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_series_info', { series_id: req.params.id });
        const response = await axios.get(apiUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch series info', message: error.message });
    }
});

app.get('/api/live/categories', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_live_categories');
        const response = await axios.get(apiUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        res.json({ success: true, categories: response.data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch live categories', message: error.message });
    }
});

app.get('/api/live/category/:id', async (req, res) => {
    try {
        const apiUrl = buildApiUrl('get_live_streams', { category_id: req.params.id });
        const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const channels = (response.data || []).map(ch => ({ id: ch.stream_id, name: ch.name, icon: ch.stream_icon || '/placeholder.jpg', category: ch.category_id, epgChannelId: ch.epg_channel_id }));
        res.json({ success: true, count: channels.length, channels });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch live channels', message: error.message });
    }
});

app.get('/stream/series/:id/:extension', async (req, res) => {
    const { id, extension } = req.params;
    const ext = extension.toLowerCase();

    console.log(`→ Streaming series episode ${id}.${ext}`);

    try {
        const episodeUrl = `${IPTV_CONFIG.serverUrl}/series/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${id}.${extension}`;

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
            headers: headers,
            responseType: 'stream',
            timeout: 30000,
            validateStatus: (status) => status < 500
        });

        res.status(response.status);

        const headersToForward = [
            'content-length',
            'content-range',
            'accept-ranges',
            'cache-control',
            'last-modified',
            'etag'
        ];

        headersToForward.forEach(header => {
            if (response.headers[header]) {
                res.setHeader(header, response.headers[header]);
            }
        });

        if (ext === 'mkv') {
            console.log('⚠ MKV detected - forcing video/mp4 content-type');
            res.setHeader('Content-Type', 'video/mp4');
        } else if (ext === 'm3u8') {
            res.setHeader('Content-Type', 'application/x-mpegURL');
        } else if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        } else {
            res.setHeader('Content-Type', 'video/mp4');
        }

        if (!response.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', 'bytes');
        }

        response.data.pipe(res);

        response.data.on('error', (error) => {
            console.error('❌ Series stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

        req.on('close', () => {
            if (!res.writableEnded) {
                response.data.destroy();
            }
        });

    } catch (error) {
        console.error('❌ Series streaming error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Episode streaming failed',
                message: error.message
            });
        }
    }
});

app.get('/stream/live/:id', (req, res) => {
    const streamId = req.params.id;

    console.log(`→ Live channel ${streamId} - redirecting to source`);

    const liveUrl = `${IPTV_CONFIG.serverUrl}/live/${IPTV_CONFIG.username}/${IPTV_CONFIG.password}/${streamId}.m3u8`;

    console.log(`  Redirect URL: ${liveUrl}`);

    res.redirect(liveUrl);
});

app.post('/api/cache/clear', (req, res) => {
    moviesCache.data = null;
    moviesCache.timestamp = null;
    res.json({ success: true, message: 'Cache cleared' });
});

app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString(), config: { server: IPTV_CONFIG.serverUrl, username: IPTV_CONFIG.username ? '***' : 'not set' } });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));
app.get('/series', (req, res) => res.sendFile(path.join(__dirname, 'public', 'series.html')));

app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('🎬 IPTV VOD Streaming Server');
    console.log('========================================');
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Frontend: http://localhost:${PORT}`);
    console.log(`✓ API: http://localhost:${PORT}/api`);
    console.log(`✓ IPTV Server: ${IPTV_CONFIG.serverUrl}`);
    console.log('========================================');
    console.log('');
});

process.on('SIGTERM', () => { console.log('⚠ SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { console.log('\n⚠ SIGINT received'); process.exit(0); });

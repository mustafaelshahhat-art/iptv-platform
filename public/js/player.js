const API_BASE = window.location.origin;

const urlParams = new URLSearchParams(window.location.search);
const contentId = urlParams.get('id');
const contentType = urlParams.get('type') || 'movie';
const movieExt = urlParams.get('ext') || 'mp4';

let playerLoading, playerError, playerErrorMessage, playerWrapper, movieInfo, movieTitle, movieYear, movieRating;
let player = null;
let playerInitialized = false;
let sourceSet = false;
let playbackStarted = false;

const isLiveMode = contentType === 'live';
const isSeriesMode = contentType === 'series';

console.log('🎬 Player - Type:', contentType, 'ID:', contentId);

// Wait for element to exist in DOM
function waitForElement(id, maxAttempts = 20, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            const el = document.getElementById(id);
            if (el) {
                resolve(el);
            } else if (attempts >= maxAttempts) {
                reject(new Error(`Element #${id} not found after ${maxAttempts} attempts`));
            } else {
                attempts++;
                setTimeout(check, interval);
            }
        };
        check();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    playerLoading = document.getElementById('player-loading');
    playerError = document.getElementById('player-error');
    playerErrorMessage = document.getElementById('player-error-message');
    playerWrapper = document.getElementById('player-wrapper');
    movieInfo = document.getElementById('movie-info');
    movieTitle = document.getElementById('movie-title');
    movieYear = document.getElementById('movie-year');
    movieRating = document.getElementById('movie-rating');

    // Setup dynamic back button
    setupBackButton();

    if (!contentId) {
        showError('No content selected.');
        return;
    }

    if (!playerInitialized) {
        initializePlayer();
    }
});

function setupBackButton() {
    const backBtn = document.getElementById('back-btn');
    const backText = document.getElementById('back-text');
    const logoText = document.getElementById('logo-text');

    if (isLiveMode) {
        backBtn.href = '/live';
        backText.textContent = 'Back to Live TV';
        logoText.textContent = 'Live TV';
    } else if (isSeriesMode) {
        backBtn.href = '/series';
        backText.textContent = 'Back to Series';
        logoText.textContent = 'Series';
    } else {
        backBtn.href = '/movies';
        backText.textContent = 'Back to Movies';
        logoText.textContent = 'Movies';
    }
}

function initializePlayer() {
    if (playerInitialized) {
        console.warn('⚠ Already initialized');
        return;
    }

    playerInitialized = true;

    // Wait for video element
    waitForElement('video-player', 30, 100)
        .then(videoElement => {
            console.log('✓ Video element found');
            setupPlayer(videoElement);
        })
        .catch(err => {
            console.error('❌ ' + err.message);
            showError('Video element not found. Please refresh the page.');
        });
}

function setupPlayer(videoElement) {
    try {
        const streamUrl = buildStreamUrl();
        const mimeType = getVideoMimeType();
        const contentData = getContentData();

        console.log('→ Stream URL:', streamUrl);
        console.log('→ MIME:', mimeType);

        playerLoading.style.display = 'none';
        playerWrapper.style.display = 'block';

        const options = isLiveMode ? getLiveOptions() : getVodOptions();

        player = videojs('video-player', options);

        player.ready(function () {
            console.log('✓ Player ready');

            if (!sourceSet) {
                sourceSet = true;
                this.src({ type: mimeType, src: streamUrl });
            }

            if (contentData) {
                displayContentInfo(contentData);
            }

            setupEvents(this);

            if (isLiveMode) {
                startLivePlayback(this);
            }
        });

    } catch (error) {
        console.error('❌ Init failed:', error);
        showError(error.message);
    }
}

function getLiveOptions() {
    return {
        controls: true,
        autoplay: false,
        muted: false,
        preload: 'auto',
        fluid: true,
        aspectRatio: '16:9',
        liveui: true,
        playbackRates: [1],
        controlBar: {
            progressControl: false,
            remainingTimeDisplay: false,
            durationDisplay: false
        },
        html5: {
            vhs: {
                overrideNative: true,
                enableLowInitialPlaylist: true
            },
            nativeVideoTracks: false,
            nativeAudioTracks: false,
            nativeTextTracks: false
        }
    };
}

function getVodOptions() {
    return {
        controls: true,
        autoplay: false,
        preload: 'metadata',
        fluid: true,
        aspectRatio: '16:9',
        liveui: false,
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        html5: {
            vhs: { overrideNative: true },
            nativeVideoTracks: false,
            nativeAudioTracks: false,
            nativeTextTracks: false
        }
    };
}

function startLivePlayback(p) {
    console.log('→ Starting live');

    p.one('loadedmetadata', () => {
        console.log('✓ Metadata');
        p.play().then(() => {
            console.log('✓ Playback started with sound');
            playbackStarted = true;
        }).catch(err => {
            console.warn('⚠ Autoplay blocked - showing play button');
            showPlayOverlay(p);
        });
    });

    p.on('playing', () => {
        if (!playbackStarted) {
            playbackStarted = true;
            hideOverlays();
        }
    });
}

function showPlayOverlay(p) {
    if (document.querySelector('.play-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.innerHTML = '<div class="play-overlay-content"><div class="play-icon">▶</div><div class="play-text">Click to Play</div></div>';

    overlay.onclick = () => {
        p.muted(false);
        p.play().then(() => {
            playbackStarted = true;
            overlay.remove();
        });
    };

    playerWrapper.appendChild(overlay);
}

function hideOverlays() {
    document.querySelectorAll('.play-overlay, .unmute-overlay').forEach(e => e.remove());
}

function setupEvents(p) {
    p.on('error', () => {
        const err = p.error();
        if (!err) return;

        let msg = 'Playback error';
        if (err.code === 2) msg = isLiveMode ? 'Channel offline' : 'Network error';
        if (err.code === 4) msg = 'Format not supported';

        showError(msg);
    });
}

function buildStreamUrl() {
    if (isLiveMode) return `${API_BASE}/stream/live/${contentId}`;
    if (isSeriesMode) return `${API_BASE}/stream/series/${contentId}/${movieExt}`;
    return `${API_BASE}/stream/${contentId}?ext=${movieExt}`;
}

function getVideoMimeType() {
    if (isLiveMode) return 'application/x-mpegURL';
    const ext = movieExt.toLowerCase();
    if (ext === 'm3u8') return 'application/x-mpegURL';
    if (ext === 'mkv') return 'video/mp4';
    return 'video/mp4';
}

function getContentData() {
    try {
        const key = isLiveMode ? 'currentChannel' : isSeriesMode ? 'currentEpisode' : 'currentMovie';
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function displayContentInfo(content) {
    movieTitle.textContent = content.name || content.title || 'Unknown';

    if (isLiveMode) {
        movieYear.textContent = 'LIVE';
        movieYear.style.cssText = 'display:inline;color:#e50914;font-weight:700';
    } else if (isSeriesMode && content.season) {
        movieYear.textContent = `S${content.season}E${content.episode}`;
        movieYear.style.cssText = 'display:inline';
    } else if (content.year && content.year !== 'N/A') {
        movieYear.textContent = content.year;
        movieYear.style.cssText = 'display:inline';
    } else {
        movieYear.style.display = 'none';
    }

    movieRating.textContent = content.rating && content.rating !== 'N/A' ? `★ ${content.rating}` : '★ N/A';
    movieInfo.style.display = 'block';
}

function showError(message) {
    playerErrorMessage.textContent = message;
    playerLoading.style.display = 'none';
    playerWrapper.style.display = 'none';
    playerError.style.display = 'flex';
}

function retryPlayer() {
    playerInitialized = false;
    sourceSet = false;
    playbackStarted = false;

    if (player) {
        try { player.dispose(); } catch (e) { }
        player = null;
    }

    // Recreate video element if needed
    const wrapper = document.getElementById('player-wrapper');
    if (wrapper && !document.getElementById('video-player')) {
        wrapper.innerHTML = `
            <video id="video-player" class="video-js vjs-big-play-centered vjs-fluid" controls preload="auto"
                poster="" data-setup='{"fluid": true, "aspectRatio": "16:9"}'>
                <p class="vjs-no-js">
                    To view this video please enable JavaScript, and consider upgrading to a
                    web browser that supports HTML5 video
                </p>
            </video>
        `;
    }

    playerError.style.display = 'none';
    playerLoading.style.display = 'flex';

    setTimeout(() => initializePlayer(), 300);
}

window.addEventListener('beforeunload', () => {
    if (player) {
        try { player.dispose(); } catch (e) { }
    }
});

window.retryPlayer = retryPlayer;

'use strict';

// ==========================================
// IPTV VIDEO PLAYER
// Production-Ready Player Controller
// ==========================================

const API_BASE = window.location.origin;

// Parse URL parameters safely
const urlParams = new URLSearchParams(window.location.search);
const contentId = sanitizeInput(urlParams.get('id'));
const contentType = sanitizeInput(urlParams.get('type')) || 'movie';
const movieExt = sanitizeExtension(urlParams.get('ext'));

// Player state
let player = null;
let playerInitialized = false;
let sourceSet = false;
let playbackStarted = false;
let retryCount = 0;

// DOM element references
let elements = {
    loading: null,
    error: null,
    errorMessage: null,
    wrapper: null,
    info: null,
    title: null,
    year: null,
    rating: null,
    backBtn: null,
    backText: null,
    logoText: null
};

// Content modes
const isLiveMode = contentType === 'live';
const isSeriesMode = contentType === 'series';

// ==========================================
// INPUT SANITIZATION
// ==========================================

function sanitizeInput(value) {
    if (!value) return null;
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
}

function sanitizeExtension(ext) {
    const allowed = ['mp4', 'mkv', 'avi', 'm3u8', 'ts'];
    const clean = String(ext || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    return allowed.includes(clean) ? clean : 'mp4';
}

// ==========================================
// DOM HELPERS
// ==========================================

function getElement(id) {
    const el = document.getElementById(id);
    return el || null;
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

function cacheElements() {
    elements = {
        loading: getElement('player-loading'),
        error: getElement('player-error'),
        errorMessage: getElement('player-error-message'),
        wrapper: getElement('player-wrapper'),
        info: getElement('movie-info'),
        title: getElement('movie-title'),
        year: getElement('movie-year'),
        rating: getElement('movie-rating'),
        backBtn: getElement('back-btn'),
        backText: getElement('back-text'),
        logoText: getElement('logo-text')
    };
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    setupBackButton();

    if (!contentId) {
        showError('No content selected');
        return;
    }

    if (!playerInitialized) {
        initializePlayer();
    }
});

function setupBackButton() {
    const { backBtn, backText, logoText } = elements;

    if (!backBtn || !backText || !logoText) return;

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

// ==========================================
// PLAYER LIFECYCLE
// ==========================================

function initializePlayer() {
    if (playerInitialized) return;
    playerInitialized = true;

    waitForElement('video-player', 30, 100)
        .then(setupPlayer)
        .catch(() => showError('Player initialization failed'));
}

function waitForElement(id, maxAttempts = 30, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const check = () => {
            const el = document.getElementById(id);
            if (el) {
                resolve(el);
            } else if (attempts >= maxAttempts) {
                reject(new Error('Element not found'));
            } else {
                attempts++;
                setTimeout(check, interval);
            }
        };

        check();
    });
}

function setupPlayer(videoElement) {
    if (!videoElement) {
        showError('Video element not available');
        return;
    }

    try {
        const streamUrl = buildStreamUrl();
        const mimeType = getVideoMimeType();
        const contentData = getContentData();

        if (!streamUrl) {
            showError('Invalid stream configuration');
            return;
        }

        setDisplay(elements.loading, 'none');
        setDisplay(elements.wrapper, 'block');

        const options = isLiveMode ? getLiveOptions() : getVodOptions();

        // Dispose existing player if any
        disposePlayer();

        player = videojs('video-player', options);

        player.ready(function () {
            const p = this;

            if (!sourceSet) {
                sourceSet = true;
                p.src({ type: mimeType, src: streamUrl });
            }

            if (contentData) {
                displayContentInfo(contentData);
            }

            setupPlayerEvents(p);

            if (isLiveMode) {
                startLivePlayback(p);
            }
        });

    } catch (error) {
        showError('Failed to initialize player');
    }
}

function disposePlayer() {
    if (player) {
        try {
            player.dispose();
        } catch (e) {
            // Ignore disposal errors
        }
        player = null;
    }
}

// ==========================================
// PLAYER OPTIONS
// ==========================================

function getLiveOptions() {
    return {
        controls: true,
        autoplay: false,
        muted: false,
        preload: 'none',
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
                enableLowInitialPlaylist: true,
                withCredentials: false,
                handleManifestRedirects: true,
                smoothQualityChange: true
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
            vhs: {
                overrideNative: true
            },
            nativeVideoTracks: false,
            nativeAudioTracks: false,
            nativeTextTracks: false
        }
    };
}

// ==========================================
// LIVE PLAYBACK
// ==========================================

function startLivePlayback(p) {
    if (!p) return;

    let metadataTimeout = null;

    // Timeout for metadata loading
    metadataTimeout = setTimeout(() => {
        if (!playbackStarted) {
            showPlayOverlay(p);
        }
    }, 10000);

    p.one('loadedmetadata', () => {
        clearTimeout(metadataTimeout);

        p.play()
            .then(() => {
                playbackStarted = true;
                hideOverlays();
            })
            .catch(() => {
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

// ==========================================
// OVERLAYS
// ==========================================

function showPlayOverlay(p) {
    if (!p || !elements.wrapper) return;
    if (document.querySelector('.play-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.innerHTML = `
        <div class="play-overlay-content">
            <div class="play-icon">▶</div>
            <div class="play-text">Click to Play</div>
        </div>
    `;

    overlay.onclick = () => {
        p.muted(false);
        p.play()
            .then(() => {
                playbackStarted = true;
                overlay.remove();
            })
            .catch(() => {
                // Fallback: try muted playback
                p.muted(true);
                p.play().catch(() => { });
            });
    };

    elements.wrapper.appendChild(overlay);
}

function hideOverlays() {
    document.querySelectorAll('.play-overlay, .unmute-overlay').forEach(el => {
        if (el && el.parentNode) {
            el.remove();
        }
    });
}

// ==========================================
// EVENT HANDLING
// ==========================================

function setupPlayerEvents(p) {
    if (!p) return;

    let hasRetried = false;
    const maxRetries = 2;

    p.on('error', () => {
        const error = p.error();
        if (!error) return;

        // Retry logic for live streams
        if (isLiveMode && !hasRetried && retryCount < maxRetries && error.code === 4) {
            hasRetried = true;
            retryCount++;

            setTimeout(() => {
                const tsUrl = `${API_BASE}/stream/live/${contentId}`;
                p.src({ type: 'application/x-mpegURL', src: tsUrl });
                p.play().catch(() => { });
            }, 1000);

            return;
        }

        const message = getErrorMessage(error.code);
        showError(message);
    });

    p.on('waiting', () => {
        // Handle buffering if needed
    });

    p.on('stalled', () => {
        // Handle stalled playback if needed
    });
}

function getErrorMessage(code) {
    const messages = {
        1: 'Playback aborted',
        2: isLiveMode ? 'Channel unavailable' : 'Network error',
        3: 'Decoding error',
        4: isLiveMode ? 'Channel not available' : 'Format not supported',
        5: 'Stream encrypted'
    };

    return messages[code] || 'Playback error';
}

// ==========================================
// URL & MIME HANDLING
// ==========================================

function buildStreamUrl() {
    if (!contentId) return null;

    if (isLiveMode) {
        return `${API_BASE}/stream/live/${contentId}`;
    }

    if (isSeriesMode) {
        return `${API_BASE}/stream/series/${contentId}/${movieExt}`;
    }

    return `${API_BASE}/stream/${contentId}?ext=${movieExt}`;
}

function getVideoMimeType() {
    if (isLiveMode) return 'application/x-mpegURL';

    const ext = movieExt.toLowerCase();

    switch (ext) {
        case 'm3u8':
            return 'application/x-mpegURL';
        case 'ts':
            return 'video/mp2t';
        case 'mkv':
        case 'mp4':
        case 'avi':
        default:
            return 'video/mp4';
    }
}

// ==========================================
// CONTENT DATA
// ==========================================

function getContentData() {
    try {
        const keys = {
            live: 'currentChannel',
            series: 'currentEpisode',
            movie: 'currentMovie'
        };

        const key = keys[contentType] || keys.movie;
        const data = sessionStorage.getItem(key);

        if (!data) return null;

        const parsed = JSON.parse(data);

        // Basic validation
        if (typeof parsed !== 'object' || parsed === null) {
            return null;
        }

        return parsed;

    } catch (e) {
        return null;
    }
}

function displayContentInfo(content) {
    if (!content) return;

    setText(elements.title, content.name || content.title || 'Unknown');

    if (elements.year) {
        if (isLiveMode) {
            elements.year.textContent = 'LIVE';
            elements.year.style.cssText = 'display:inline;color:#e50914;font-weight:700';
        } else if (isSeriesMode && content.season) {
            elements.year.textContent = `S${content.season}E${content.episode}`;
            elements.year.style.cssText = 'display:inline';
        } else if (content.year && content.year !== 'N/A') {
            elements.year.textContent = content.year;
            elements.year.style.cssText = 'display:inline';
        } else {
            elements.year.style.display = 'none';
        }
    }

    if (elements.rating) {
        const rating = content.rating && content.rating !== 'N/A' ? content.rating : 'N/A';
        elements.rating.textContent = `★ ${rating}`;
    }

    setDisplay(elements.info, 'block');
}

// ==========================================
// ERROR DISPLAY
// ==========================================

function showError(message) {
    setText(elements.errorMessage, message || 'An error occurred');
    setDisplay(elements.loading, 'none');
    setDisplay(elements.wrapper, 'none');
    setDisplay(elements.error, 'flex');

    hideOverlays();
}

// ==========================================
// RETRY FUNCTIONALITY
// ==========================================

function retryPlayer() {
    // Reset state
    playerInitialized = false;
    sourceSet = false;
    playbackStarted = false;
    retryCount = 0;

    // Dispose existing player
    disposePlayer();

    // Recreate video element
    const wrapper = elements.wrapper || getElement('player-wrapper');

    if (wrapper) {
        const existingVideo = getElement('video-player');

        if (!existingVideo) {
            wrapper.innerHTML = `
                <video id="video-player" 
                       class="video-js vjs-big-play-centered vjs-fluid" 
                       controls 
                       preload="auto"
                       data-setup='{"fluid": true, "aspectRatio": "16:9"}'>
                    <p class="vjs-no-js">
                        JavaScript is required for video playback.
                    </p>
                </video>
            `;
        }
    }

    // Update UI
    setDisplay(elements.error, 'none');
    setDisplay(elements.loading, 'flex');

    // Re-cache elements
    cacheElements();

    // Reinitialize
    setTimeout(initializePlayer, 300);
}

// ==========================================
// CLEANUP
// ==========================================

window.addEventListener('beforeunload', () => {
    disposePlayer();
});

window.addEventListener('pagehide', () => {
    disposePlayer();
});

// Expose retry function globally
window.retryPlayer = retryPlayer;

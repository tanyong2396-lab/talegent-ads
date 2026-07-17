// ============================================================
// Talegent Visitor Click Tracker
// Records user clicks with device info, IP, location, etc.
// Sends data to Cloudflare Worker API
// ============================================================

(function() {
    'use strict';

    // Configuration
    const API_URL = '/api/track';  // Relative URL - works with Cloudflare Worker on same domain
    const SITE_NAME = 'Talegent Sodium UPS';
    const SITE_VERSION = '1.0';

    // Track when the page was first loaded
    const pageLoadTime = Date.now();
    const sessionId = generateId();

    function generateId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ============================================================
    // Collect User Information
    // ============================================================
    function collectUserInfo() {
        const info = {
            sessionId: sessionId,
            url: window.location.href,
            referrer: document.referrer || '(direct)',
            language: navigator.language || navigator.userLanguage || 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
            screenSize: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            colorDepth: window.screen.colorDepth || 'unknown',
            pixelRatio: window.devicePixelRatio || 1,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack || 'unspecified',
            siteName: SITE_NAME,
            siteVersion: SITE_VERSION,
        };

        // Device type detection
        const ua = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
            info.deviceType = 'Mobile';
        } else if (/Tablet|iPad|PlayBook|Silk/i.test(ua)) {
            info.deviceType = 'Tablet';
        } else {
            info.deviceType = 'Desktop';
        }

        // Operating system
        if (ua.indexOf('Windows') !== -1) info.os = 'Windows';
        else if (ua.indexOf('Mac OS') !== -1) info.os = 'macOS';
        else if (ua.indexOf('Linux') !== -1) info.os = 'Linux';
        else if (ua.indexOf('Android') !== -1) info.os = 'Android';
        else if (ua.indexOf('iOS') !== -1 || ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) info.os = 'iOS';
        else info.os = 'Unknown';

        // Browser detection
        if (ua.indexOf('Chrome') !== -1 && ua.indexOf('Edg') === -1) info.browser = 'Chrome';
        else if (ua.indexOf('Firefox') !== -1) info.browser = 'Firefox';
        else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) info.browser = 'Safari';
        else if (ua.indexOf('Edg') !== -1) info.browser = 'Edge';
        else if (ua.indexOf('MSIE') !== -1 || ua.indexOf('Trident') !== -1) info.browser = 'Internet Explorer';
        else info.browser = 'Unknown';

        // Connection type (if available)
        if (navigator.connection) {
            info.connectionType = navigator.connection.effectiveType || 'unknown';
            info.connectionSpeed = navigator.connection.downlink || 'unknown';
        }

        // Get IP and location via Cloudflare headers (will be added server-side)
        // We send the request, and the Worker adds CF-IPCountry etc.

        return info;
    }

    // ============================================================
    // Send tracking data to Worker API
    // ============================================================
    function sendTrackData(eventData) {
        const payload = {
            ...collectUserInfo(),
            ...eventData,
            timeOnPage: Date.now() - pageLoadTime,
        };

        // Use sendBeacon for reliability (works even when page is closing)
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(API_URL, blob);
        } else {
            // Fallback to fetch
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(err => {
                // Silently fail - tracking should not affect user experience
                console.debug('Track error:', err);
            });
        }
    }

    // ============================================================
    // Track page view on load
    // ============================================================
    function trackPageView() {
        sendTrackData({
            eventType: 'pageview',
            elementId: 'page',
            elementText: document.title,
        });
    }

    // ============================================================
    // Track all button clicks and important interactions
    // ============================================================
    function setupClickTracking() {
        // Track all anchor tags (links)
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a, button, .btn, [onclick]');
            if (!target) return;

            const tagName = target.tagName.toLowerCase();
            const elementId = target.id || '';
            const elementClass = target.className || '';
            const href = target.href || '';
            const text = (target.textContent || '').trim().substring(0, 100);

            let eventType = 'click';
            let category = 'general';

            // Categorize clicks
            if (href.includes('wa.me') || href.includes('whatsapp')) {
                category = 'whatsapp';
                eventType = 'whatsapp_click';
            } else if (href.includes('mailto:')) {
                category = 'email';
                eventType = 'email_click';
            } else if (href.startsWith('#')) {
                category = 'navigation';
                eventType = 'nav_click';
            } else if (tagName === 'button' || elementClass.includes('btn')) {
                category = 'button';
            }

            // Track the click
            sendTrackData({
                eventType: eventType,
                category: category,
                elementId: elementId,
                elementClass: elementClass,
                elementText: text,
                href: href,
                tagName: tagName,
            });
        }, true); // Use capture phase to catch all clicks
    }

    // ============================================================
    // Track scroll depth
    // ============================================================
    let maxScroll = 0;
    function setupScrollTracking() {
        let scrollTimer = null;
        window.addEventListener('scroll', function() {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function() {
                const scrollPercent = Math.round(
                    (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
                );
                if (scrollPercent > maxScroll) {
                    maxScroll = scrollPercent;
                    // Track at 25%, 50%, 75%, 100%
                    if ([25, 50, 75, 100].includes(scrollPercent)) {
                        sendTrackData({
                            eventType: 'scroll',
                            category: 'engagement',
                            scrollDepth: scrollPercent + '%',
                        });
                    }
                }
            }, 500);
        }, { passive: true });
    }

    // ============================================================
    // Track time on page (after 30 seconds)
    // ============================================================
    function setupTimeTracking() {
        setTimeout(function() {
            sendTrackData({
                eventType: 'time_on_page',
                category: 'engagement',
                timeOnPage: 30000,
                label: '30s',
            });
        }, 30000);

        setTimeout(function() {
            sendTrackData({
                eventType: 'time_on_page',
                category: 'engagement',
                timeOnPage: 60000,
                label: '60s',
            });
        }, 60000);
    }

    // ============================================================
    // Track page leave
    // ============================================================
    function setupLeaveTracking() {
        window.addEventListener('beforeunload', function() {
            sendTrackData({
                eventType: 'pageleave',
                category: 'engagement',
                timeOnPage: Date.now() - pageLoadTime,
                maxScrollDepth: maxScroll + '%',
            });
        });

        // Also track visibility change (user switching tabs)
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                sendTrackData({
                    eventType: 'tab_hidden',
                    category: 'engagement',
                    timeOnPage: Date.now() - pageLoadTime,
                });
            } else {
                sendTrackData({
                    eventType: 'tab_visible',
                    category: 'engagement',
                    timeOnPage: Date.now() - pageLoadTime,
                });
            }
        });
    }

    // ============================================================
    // Initialize
    // ============================================================
    function init() {
        // Track page view when DOM is ready
        if (document.readyState === 'complete') {
            trackPageView();
        } else {
            window.addEventListener('load', trackPageView);
        }

        setupClickTracking();
        setupScrollTracking();
        setupTimeTracking();
        setupLeaveTracking();

        console.log('Talegent Visitor Tracker initialized ✓');
    }

    // Start tracking
    init();
})();
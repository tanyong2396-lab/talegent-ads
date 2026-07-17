// ============================================================
// Talegent Visitor Analytics Tracker - Client Side
// Runs in browser - collects anonymized visitor data
// Compliant with GDPR & China Personal Information Protection Law
// ============================================================

(function() {
    'use strict';

    // Configuration
    const API_URL = 'https://talegent-tracker-api.tanyong2396.workers.dev/api/track';
    const SITE_NAME = 'Talegent Sodium UPS';
    const SITE_VERSION = '1.0';
    const COOKIE_NAME = 'talegent_visitor';
    const COOKIE_EXPIRY_DAYS = 365;

    // Session tracking
    const pageLoadTime = Date.now();
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // ============================================================
    // Cookie management for anonymous visitor ID
    // ============================================================
    function getVisitorId() {
        const cookies = document.cookie.split('; ');
        for (let c of cookies) {
            const [name, value] = c.split('=');
            if (name === COOKIE_NAME) return value;
        }
        // Generate new anonymous ID
        const newId = 'vis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
        const expires = new Date(Date.now() + COOKIE_EXPIRY_DAYS * 86400000).toUTCString();
        document.cookie = COOKIE_NAME + '=' + newId + '; expires=' + expires + '; path=/; SameSite=Lax';
        return newId;
    }

    // ============================================================
    // Collect anonymized user information
    // ============================================================
    function collectUserInfo() {
        var ua = navigator.userAgent;
        
        // Device type detection from UA (no storage of raw UA)
        var deviceType = 'Desktop';
        if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
            deviceType = 'Mobile';
        } else if (/Tablet|iPad|PlayBook|Silk/i.test(ua)) {
            deviceType = 'Tablet';
        }

        // OS detection (category only, no version)
        var os = 'Unknown';
        if (ua.indexOf('Windows') !== -1) os = 'Windows';
        else if (ua.indexOf('Mac OS') !== -1) os = 'macOS';
        else if (ua.indexOf('Linux') !== -1) os = 'Linux';
        else if (ua.indexOf('Android') !== -1) os = 'Android';
        else if (ua.indexOf('iOS') !== -1 || ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';

        // Browser detection (category only)
        var browser = 'Unknown';
        if (ua.indexOf('Chrome') !== -1 && ua.indexOf('Edg') === -1) browser = 'Chrome';
        else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
        else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
        else if (ua.indexOf('Edg') !== -1) browser = 'Edge';
        else if (ua.indexOf('MSIE') !== -1 || ua.indexOf('Trident') !== -1) browser = 'Internet Explorer';

        return {
            visitor_id: getVisitorId(),
            session_id: sessionId,
            url: window.location.href,
            referrer: document.referrer || '(direct)',
            language: navigator.language || 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            device_type: deviceType,
            os: os,
            browser: browser,
            site_name: SITE_NAME,
            site_version: SITE_VERSION,
        };
    }

    // ============================================================
    // Send tracking data to Worker API
    // ============================================================
    function sendTrackData(eventData) {
        var payload = {
            ...collectUserInfo(),
            ...eventData,
            time_on_page: Date.now() - pageLoadTime,
        };

        // Use sendBeacon for reliability
        if (navigator.sendBeacon) {
            var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(API_URL, blob);
        } else {
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(function() {});
        }
    }

    // ============================================================
    // Track page view
    // ============================================================
    function trackPageView() {
        sendTrackData({
            event_type: 'pageview',
            page_title: document.title,
        });
    }

    // ============================================================
    // Track clicks (anonymized)
    // ============================================================
    function setupClickTracking() {
        document.addEventListener('click', function(e) {
            var target = e.target.closest('a, button, .btn, [onclick]');
            if (!target) return;

            var href = target.href || '';
            var text = (target.textContent || '').trim().substring(0, 100);

            var category = 'general';
            var eventType = 'click';

            if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp') !== -1) {
                category = 'whatsapp';
                eventType = 'whatsapp_click';
            } else if (href.indexOf('mailto:') !== -1) {
                category = 'email';
                eventType = 'email_click';
            } else if (href.indexOf('#') === 0) {
                category = 'navigation';
                eventType = 'nav_click';
            } else if (target.tagName === 'BUTTON' || (target.className || '').indexOf('btn') !== -1) {
                category = 'button';
            }

            sendTrackData({
                event_type: eventType,
                category: category,
                element_text: text.substring(0, 50),
                href: href.substring(0, 200),
            });
        }, true);
    }

    // ============================================================
    // Track scroll depth (anonymized)
    // ============================================================
    var maxScroll = 0;
    function setupScrollTracking() {
        var timer = null;
        window.addEventListener('scroll', function() {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() {
                var percent = Math.round(
                    (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
                );
                if (percent > maxScroll) {
                    maxScroll = percent;
                    if (percent === 25 || percent === 50 || percent === 75 || percent === 100) {
                        sendTrackData({
                            event_type: 'scroll',
                            category: 'engagement',
                            scroll_depth: percent + '%',
                        });
                    }
                }
            }, 500);
        }, { passive: true });
    }

    // ============================================================
    // Track time on page
    // ============================================================
    function setupTimeTracking() {
        setTimeout(function() {
            sendTrackData({ event_type: 'time_on_page', category: 'engagement', label: '30s' });
        }, 30000);
        setTimeout(function() {
            sendTrackData({ event_type: 'time_on_page', category: 'engagement', label: '60s' });
        }, 60000);
    }

    // ============================================================
    // Track page leave
    // ============================================================
    function setupLeaveTracking() {
        window.addEventListener('beforeunload', function() {
            sendTrackData({
                event_type: 'pageleave',
                category: 'engagement',
                duration: Date.now() - pageLoadTime,
                max_scroll: maxScroll + '%',
            });
        });
    }

    // ============================================================
    // Initialize
    // ============================================================
    function init() {
        if (document.readyState === 'complete') {
            trackPageView();
        } else {
            window.addEventListener('load', trackPageView);
        }
        setupClickTracking();
        setupScrollTracking();
        setupTimeTracking();
        setupLeaveTracking();
        console.log('Talegent Analytics initialized ✓');
    }

    init();
})();
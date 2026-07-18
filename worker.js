// ============================================================
// Cloudflare Worker - Talegent All-in-One
// Serves: Website + Dashboard + Analytics Script + API (KV storage)
// ============================================================

const TRACKER_CLIENT_JS = `// ============================================================
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
})();`;

const INDEX_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Talegent® Sodium-ion UPS Solution</title><style> * { margin: 0; padding: 0; box-sizing: border-box; } html { scroll-behavior: smooth; } body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a2e; background: #fff; line-height: 1.6; } :root { --navy:#0A1F44; --blue:#1A73E8; --teal:#009688; --orange:#FF6F00; --green:#2E7D32; --red:#C62828; --purple:#6A1B9A; --light-bg:#F5F7FA; --card-bg:#EEF1F6; --dark:#1a1a2e; --gray:#666677; --whatsapp:#25D366; } .navbar { position:fixed; top:0; width:100%; background:rgba(10,31,68,0.95); backdrop-filter:blur(10px); z-index:1000; padding:0 2rem; display:flex; justify-content:space-between; align-items:center; height:70px; border-bottom:3px solid var(--blue); } .navbar .logo { color:white; font-size:1.4rem; font-weight:700; } .navbar .logo span { color:var(--blue); } .nav-links { display:flex; gap:2rem; list-style:none; } .nav-links a { color:rgba(255,255,255,0.85); text-decoration:none; font-size:0.95rem; font-weight:500; transition:color 0.3s; } .nav-links a:hover { color:var(--blue); } .hamburger { display:none; flex-direction:column; cursor:pointer; gap:5px; } .hamburger span { width:25px; height:3px; background:white; border-radius:2px; } .hero { background:linear-gradient(135deg,var(--navy) 0%,#0D2B5A 50%,#1A3A6A 100%); min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:100px 2rem 60px; position:relative; overflow:hidden; } .hero::before { content:''; position:absolute; top:0;left:0;right:0;bottom:0; background:radial-gradient(circle at 20% 50%,rgba(26,115,232,0.15) 0%,transparent 50%),radial-gradient(circle at 80% 50%,rgba(255,111,0,0.1) 0%,transparent 50%); } .hero * { position:relative; z-index:1; } .hero h1 { font-size:3.2rem; color:white; margin-bottom:0.5rem; font-weight:800; } .hero h1 span { color:var(--blue); } .hero .tagline { font-size:1.3rem; color:#88CCFF; margin-bottom:2.5rem; font-weight:300; } .hero-cta { display:flex; gap:1rem; flex-wrap:wrap; justify-content:center; } .btn { display:inline-block; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:1rem; transition:all 0.3s; cursor:pointer; } .btn-primary { background:var(--blue); color:white; } .btn-primary:hover { background:#1557B0; transform:translateY(-2px); } .btn-whatsapp { background:var(--whatsapp); color:white; } .btn-whatsapp:hover { background:#1DA851; transform:translateY(-2px); } .btn-outline { border:2px solid rgba(255,255,255,0.3); color:white; } .btn-outline:hover { border-color:white; transform:translateY(-2px); } .hero-features { display:flex; gap:2rem; margin-top:3rem; flex-wrap:wrap; justify-content:center; } .hero-feature { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:1.2rem 2rem; min-width:180px; backdrop-filter:blur(5px); } .hero-feature .icon { font-size:1.8rem; } .hero-feature .value { color:white; font-size:1.1rem; font-weight:700; margin-top:0.3rem; } .hero-feature .label { color:#88AACC; font-size:0.85rem; } section { padding:5rem 2rem; } .section-title { text-align:center; font-size:2.2rem; font-weight:700; color:var(--navy); margin-bottom:0.5rem; } .section-subtitle { text-align:center; color:var(--gray); font-size:1.1rem; margin-bottom:3rem; max-width:700px; margin-left:auto; margin-right:auto; } .container { max-width:1200px; margin:0 auto; } .pain-points { background:var(--light-bg); } .pain-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; max-width:1000px; margin:0 auto; } .pain-item { display:flex; align-items:center; gap:1rem; background:white; padding:1rem 1.5rem; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); } .pain-item .arrow { color:var(--blue); font-size:1.2rem; font-weight:700; margin:0 0.5rem; } .pain-item .problem { color:var(--red); font-weight:600; font-size:0.9rem; flex:1; } .pain-item .solution { color:var(--green); font-weight:600; font-size:0.9rem; flex:1; } .advantages-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; } .advantage-card { background:var(--card-bg); border-radius:12px; padding:1.5rem; border-top:4px solid var(--blue); transition:transform 0.3s,box-shadow 0.3s; } .advantage-card:hover { transform:translateY(-5px); box-shadow:0 10px 30px rgba(0,0,0,0.1); } .advantage-card .icon { font-size:2rem; margin-bottom:0.5rem; } .advantage-card h3 { font-size:1.1rem; margin-bottom:0.5rem; } .advantage-card ul { list-style:none; margin-top:0.5rem; } .advantage-card ul li { color:var(--gray); font-size:0.85rem; padding:0.2rem 0; padding-left:1.2rem; position:relative; } .advantage-card ul li::before { content:'\u2022'; position:absolute; left:0; color:var(--blue); font-weight:bold; } .comparison { background:var(--light-bg); } .table-wrapper { overflow-x:auto; } table.comparison-table { width:100%; border-collapse:collapse; background:white; border-radius:12px; overflow:hidden; box-shadow:0 2px 15px rgba(0,0,0,0.08); } table.comparison-table th { background:var(--navy); color:white; padding:1rem; font-size:0.95rem; text-align:center; } table.comparison-table td { padding:0.85rem 1rem; text-align:center; font-size:0.9rem; border-bottom:1px solid #eee; } table.comparison-table tr:nth-child(even) td { background:#FAFBFC; } table.comparison-table .highlight { background:#E3F2FD !important; font-weight:700; color:var(--blue); } table.comparison-table td:first-child { text-align:left; font-weight:600; color:var(--dark); } .charts-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; margin-bottom:2rem; } .chart-box { background:white; border-radius:12px; padding:1.5rem; box-shadow:0 2px 10px rgba(0,0,0,0.06); text-align:center; } .chart-box h4 { font-size:1rem; color:var(--navy); margin-bottom:1rem; } .bar-chart { display:flex; align-items:flex-end; justify-content:center; gap:1.5rem; height:180px; padding-top:1rem; } .bar-group { display:flex; flex-direction:column; align-items:center; gap:0.3rem; } .bar { width:50px; border-radius:6px 6px 0 0; display:flex; align-items:flex-start; justify-content:center; padding-top:5px; font-size:0.75rem; font-weight:700; color:white; min-height:20px; } .bar-label { font-size:0.75rem; color:var(--gray); text-align:center; } .bar-gray { background:#9E9E9E; } .bar-blue { background:var(--blue); } .bar-orange { background:var(--orange); } .tco-section { background:var(--navy); color:white; } .tco-section .section-title { color:white; } .tco-section .section-subtitle { color:#88AACC; } .tco-grid { display:grid; grid-template-columns:2fr 1fr; gap:2rem; align-items:start; } .tco-chart-box { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:1.5rem; } .tco-chart-box h4 { color:white; margin-bottom:1rem; text-align:center; } .tco-breakdown { background:rgba(255,255,255,0.05); border-radius:12px; padding:1.5rem; border:1px solid rgba(255,255,255,0.1); } .tco-breakdown h4 { color:white; margin-bottom:1rem; } .tco-breakdown p { color:#AABBCC; font-size:0.85rem; margin-bottom:0.3rem; } .tco-breakdown .highlight-text { color:var(--orange); font-weight:700; font-size:1.1rem; margin-top:0.5rem; } .roi-metrics { display:grid; grid-template-columns:repeat(5,1fr); gap:1rem; margin-top:2rem; } .roi-item { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:1rem; text-align:center; } .roi-item .value { font-size:1.5rem; font-weight:800; } .roi-item .label { font-size:0.8rem; color:#88AACC; margin-top:0.3rem; } .apps-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; } .app-card { background:var(--card-bg); border-radius:12px; padding:1.5rem; border-top:4px solid var(--teal); } .app-card .icon { font-size:1.8rem; margin-bottom:0.5rem; } .app-card h3 { font-size:1.1rem; margin-bottom:0.5rem; } .app-card ul { list-style:none; } .app-card ul li { color:var(--gray); font-size:0.85rem; padding:0.2rem 0; padding-left:1.2rem; position:relative; } .app-card ul li::before { content:'\u2022'; position:absolute; left:0; color:var(--teal); font-weight:bold; } .specs-grid { display:grid; grid-template-columns:1fr 1fr; gap:2rem; } .specs-table { width:100%; border-collapse:collapse; } .specs-table td { padding:0.6rem 1rem; border-bottom:1px solid #eee; font-size:0.9rem; } .specs-table td:first-child { font-weight:600; color:var(--navy); width:40%; } .specs-table td:last-child { color:var(--gray); } .specs-table tr:nth-child(even) td { background:#FAFBFC; } .integration-list { background:var(--card-bg); border-radius:12px; padding:1.5rem; } .integration-list h3 { margin-bottom:1rem; color:var(--navy); } .integration-list ul { list-style:none; } .integration-list ul li { padding:0.4rem 0; padding-left:1.8rem; position:relative; color:var(--gray); font-size:0.9rem; } .integration-list ul li::before { content:'\u2705'; position:absolute; left:0; } .cta-section { background:linear-gradient(135deg,var(--navy),#0D2B5A); text-align:center; padding:4rem 2rem; } .cta-section h2 { color:white; font-size:2.2rem; margin-bottom:0.5rem; } .cta-section p { color:#88AACC; font-size:1.1rem; margin-bottom:2rem; } .cta-buttons { display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; } .cta-buttons .btn { min-width:200px; } footer { background:#06122B; color:#667788; text-align:center; padding:2rem; font-size:0.85rem; } footer a { color:var(--blue); text-decoration:none; } .whatsapp-float { position:fixed; bottom:20px; right:20px; z-index:999; background:var(--whatsapp); color:white; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.8rem; text-decoration:none; box-shadow:0 4px 15px rgba(37,211,102,0.4); transition:all 0.3s; } .whatsapp-float:hover { transform:scale(1.1); box-shadow:0 6px 20px rgba(37,211,102,0.6); } .whatsapp-float .tooltip { position:absolute; right:70px; background:white; color:var(--dark); padding:8px 16px; border-radius:8px; font-size:0.85rem; font-weight:500; white-space:nowrap; box-shadow:0 2px 10px rgba(0,0,0,0.1); opacity:0; pointer-events:none; transition:opacity 0.3s; } .whatsapp-float:hover .tooltip { opacity:1; } @media (max-width:1024px) { .advantages-grid,.apps-grid { grid-template-columns:repeat(2,1fr); } .charts-grid { grid-template-columns:repeat(2,1fr); } .roi-metrics { grid-template-columns:repeat(3,1fr); } .tco-grid { grid-template-columns:1fr; } } @media (max-width:768px) { .nav-links { display:none; position:absolute; top:70px; left:0; right:0; background:var(--navy); flex-direction:column; padding:1rem 2rem; gap:1rem; } .nav-links.active { display:flex; } .hamburger { display:flex; } .hero h1 { font-size:2rem; } .hero .tagline { font-size:1rem; } .hero-features { gap:1rem; } .hero-feature { min-width:140px; padding:1rem; } .pain-grid { grid-template-columns:1fr; } .advantages-grid,.apps-grid { grid-template-columns:1fr; } .charts-grid { grid-template-columns:1fr; } .specs-grid { grid-template-columns:1fr; } .roi-metrics { grid-template-columns:repeat(2,1fr); } section { padding:3rem 1rem; } .section-title { font-size:1.6rem; } } @media (max-width:480px) { .hero h1 { font-size:1.5rem; } .hero-cta { flex-direction:column; align-items:center; } .btn { width:100%; text-align:center; } .roi-metrics { grid-template-columns:1fr; } } </style></head><body><nav class="navbar"><div class="logo">Talegent<span>&#174;</span></div><ul class="nav-links" id="navLinks"><li><a href="#advantages">Advantages</a></li><li><a href="#comparison">Comparison</a></li><li><a href="#tco">TCO Analysis</a></li><li><a href="#applications">Applications</a></li><li><a href="#specs">Specifications</a></li><li><a href="#contact">Contact</a></li></ul><div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div></nav><section class="hero" id="home"><h1>Talegent<span>&#174;</span> Sodium-ion <br>UPS Solution</h1><p class="tagline">Redefining UPS Backup Power with Sodium-ion Technology</p><div class="hero-cta"><a href="#advantages" class="btn btn-primary">Learn More</a><a href="https://wa.me/8618163813252?text=Hello%2C%20I%20am%20interested%20in%20your%20UPS%20products." target="_blank" class="btn btn-whatsapp">&#128172; Chat on WhatsApp</a><a href="mailto:dean@talegent-ess.com" class="btn btn-outline">&#9993; Email Us</a></div><div class="hero-features"><div class="hero-feature"><div class="icon">&#128274;</div><div class="value">Zero Fire Risk</div><div class="label">Safe for 24/7 operation</div></div><div class="hero-feature"><div class="icon">&#10052;&#65039;</div><div class="value">-20&#176;C ~ 60&#176;C</div><div class="label">Wide temperature range</div></div><div class="hero-feature"><div class="icon">&#9889;</div><div class="value">30min to 80%</div><div class="label">Fast recharge</div></div><div class="hero-feature"><div class="icon">&#128176;</div><div class="value">50-60% Savings</div><div class="label">Over 10 years vs lead-acid</div></div></div></section><section class="pain-points" id="pain-points"><div class="container"><h2 class="section-title">UPS Battery Pain Points &#8594; Sodium-ion Solution</h2><p class="section-subtitle">How sodium-ion directly addresses the 5 biggest UPS battery challenges</p><div class="pain-grid"><div class="pain-item"><span class="problem">&#128293; Thermal Runaway Risk</span><span class="arrow">&#8594;</span><span class="solution">&#10004; Zero Fire Risk</span></div><div class="pain-item"><span class="problem">&#10052;&#65039; Cold Temperature Failure</span><span class="arrow">&#8594;</span><span class="solution">&#10004; -20&#176;C Full Performance</span></div><div class="pain-item"><span class="problem">&#128176; High Replacement Cost</span><span class="arrow">&#8594;</span><span class="solution">&#10004; 3x Longer Life</span></div><div class="pain-item"><span class="problem">&#9889; Slow Recharge</span><span class="arrow">&#8594;</span><span class="solution">&#10004; 1C Fast Charge</span></div><div class="pain-item" style="grid-column:1/-1;justify-content:center;"><span class="problem">&#9851;&#65039; Environmental Hazard</span><span class="arrow">&#8594;</span><span class="solution">&#10004; 100% Recyclable</span></div></div></div></section><section id="advantages"><div class="container"><h2 class="section-title">Why Sodium-ion is the Ideal UPS Battery</h2><p class="section-subtitle">6 key advantages that make sodium-ion the perfect fit for UPS applications</p><div class="advantages-grid"><div class="advantage-card" style="border-top-color:var(--blue);"><div class="icon">&#128274;</div><h3 style="color:var(--blue);">Ultimate Safety for 24/7 Operation</h3><ul><li>No thermal runaway &#8212; zero fire risk</li><li>Passes nail penetration & overcharge tests</li><li>Safe for indoor & data center use</li></ul></div><div class="advantage-card" style="border-top-color:var(--teal);"><div class="icon">&#10052;&#65039;</div><h3 style="color:var(--teal);">No HVAC Required for Cold Sites</h3><ul><li>Full performance at -20&#176;C to 60&#176;C</li><li>Eliminates need for battery heating systems</li><li>Saves 15-20% on facility energy costs</li></ul></div><div class="advantage-card" style="border-top-color:var(--orange);"><div class="icon">&#9889;</div><h3 style="color:var(--orange);">Always Ready for Next Outage</h3><ul><li>1C fast charge: 30min to 80% SOC</li><li>2C discharge: handles high-power loads</li><li>No memory effect &#8212; partial charge OK</li></ul></div><div class="advantage-card" style="border-top-color:var(--green);"><div class="icon">&#128176;</div><h3 style="color:var(--green);">3x Lower Total Cost of Ownership</h3><ul><li>3,000+ cycles vs 500 for lead-acid</li><li>10+ year calendar life</li><li>30-40% cheaper than LFP per kWh</li></ul></div><div class="advantage-card" style="border-top-color:var(--purple);"><div class="icon">&#128202;</div><h3 style="color:var(--purple);">Smart BMS for UPS Integration</h3><ul><li>Real-time SOC & SOH monitoring</li><li>RS485/CAN for UPS communication</li><li>Predictive maintenance alerts</li></ul></div><div class="advantage-card" style="border-top-color:#009688;"><div class="icon">&#127793;</div><h3 style="color:#009688;">Sustainable & Compliant</h3><ul><li>No lead, lithium, cobalt, or nickel</li><li>100% recyclable at end of life</li><li>RoHS, REACH, UN38.3 certified</li></ul></div></div></div></section><section class="comparison" id="comparison"><div class="container"><h2 class="section-title">UPS Battery Performance Comparison</h2><p class="section-subtitle">Sodium-ion vs. Lead-acid vs. LFP &#8212; measured by UPS-critical metrics</p><div class="charts-grid"><div class="chart-box"><h4>Cycle Life (cycles)</h4><div class="bar-chart"><div class="bar-group"><div class="bar bar-gray" style="height:30px;">500</div><div class="bar-label">Lead-acid</div></div><div class="bar-group"><div class="bar bar-blue" style="height:160px;">3,000</div><div class="bar-label">LFP</div></div><div class="bar-group"><div class="bar bar-orange" style="height:160px;">3,000+</div><div class="bar-label">Sodium-ion</div></div></div></div><div class="chart-box"><h4>Cost per kWh (&#165;)</h4><div class="bar-chart"><div class="bar-group"><div class="bar bar-gray" style="height:140px;">0.50</div><div class="bar-label">Lead-acid</div></div><div class="bar-group"><div class="bar bar-blue" style="height:170px;">0.60</div><div class="bar-label">LFP</div></div><div class="bar-group"><div class="bar bar-orange" style="height:100px;">0.35</div><div class="bar-label">Sodium-ion</div></div></div></div><div class="chart-box"><h4>Operating Temp Range (&#176;C)</h4><div class="bar-chart"><div class="bar-group"><div class="bar bar-gray" style="height:110px;">50</div><div class="bar-label">Lead-acid</div></div><div class="bar-group"><div class="bar bar-blue" style="height:100px;">45</div><div class="bar-label">LFP</div></div><div class="bar-group"><div class="bar bar-orange" style="height:175px;">80</div><div class="bar-label">Sodium-ion</div></div></div></div></div><div class="table-wrapper"><table class="comparison-table"><thead><tr><th>UPS-Critical Feature</th><th>Lead-acid</th><th>LFP</th><th>Sodium-ion &#9733;</th></tr></thead><tbody><tr><td>Thermal Runaway Risk</td><td>Low</td><td>Moderate-High</td><td class="highlight">None &#10003;</td></tr><tr><td>Cold Temp (0&#176;C)</td><td>50% capacity</td><td>70% capacity</td><td class="highlight">90% capacity &#10003;</td></tr><tr><td>Recharge Time to 80%</td><td>8-10 hours</td><td>1-2 hours</td><td class="highlight">30 min &#10003;</td></tr><tr><td>Cycle Life (80% DoD)</td><td>300-500</td><td>2,000-4,000</td><td class="highlight">3,000+ &#10003;</td></tr><tr><td>Calendar Life</td><td>3-5 years</td><td>8-10 years</td><td class="highlight">10-15 years &#10003;</td></tr><tr><td>Maintenance</td><td>Regular watering</td><td>None</td><td class="highlight">None &#10003;</td></tr><tr><td>Recyclability</td><td>Complex</td><td>Moderate</td><td class="highlight">100% &#10003;</td></tr></tbody></table></div></div></section><section class="tco-section" id="tco"><div class="container"><h2 class="section-title">Total Cost of Ownership Analysis</h2><p class="section-subtitle">Why sodium-ion saves you 50%+ over 10 years compared to lead-acid</p><div class="tco-grid"><div class="tco-chart-box"><h4>10-Year Cumulative Cost Comparison (Indexed)</h4><svg viewBox="0 0 500 200" style="width:100%;height:180px;"><line x1="50" y1="180" x2="480" y2="180" stroke="#334466" stroke-width="1"/><line x1="50" y1="20" x2="50" y2="180" stroke="#334466" stroke-width="1"/><text x="55" y="30" fill="#88AACC" font-size="10">400</text><text x="55" y="80" fill="#88AACC" font-size="10">300</text><text x="55" y="130" fill="#88AACC" font-size="10">200</text><text x="55" y="175" fill="#88AACC" font-size="10">100</text><!-- Lead-acid line (gray) --><polyline points="50,130 95,130 140,80 185,80 230,80 275,30 320,30 365,30 410,20 455,20" fill="none" stroke="#9E9E9E" stroke-width="3" stroke-linejoin="round"/><!-- Sodium-ion line (orange) --><polyline points="50,105 95,105 140,105 185,105 230,105 275,105 320,105 365,105 410,105 455,105" fill="none" stroke="#FF6F00" stroke-width="3" stroke-linejoin="round"/><!-- Dots --><circle cx="50" cy="130" r="4" fill="#9E9E9E"/><circle cx="140" cy="80" r="4" fill="#9E9E9E"/><circle cx="275" cy="30" r="4" fill="#9E9E9E"/><circle cx="455" cy="20" r="4" fill="#9E9E9E"/><circle cx="50" cy="105" r="4" fill="#FF6F00"/><circle cx="140" cy="105" r="4" fill="#FF6F00"/><circle cx="275" cy="105" r="4" fill="#FF6F00"/><circle cx="455" cy="105" r="4" fill="#FF6F00"/><text x="50" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y1</text><text x="95" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y2</text><text x="140" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y3</text><text x="185" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y4</text><text x="230" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y5</text><text x="275" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y6</text><text x="320" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y7</text><text x="365" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y8</text><text x="410" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y9</text><text x="455" y="195" fill="#88AACC" font-size="8" text-anchor="middle">Y10</text></svg><div class="tco-legend"><div class="tco-legend-item"><div class="tco-legend-dot" style="background:#9E9E9E;"></div>Lead-acid</div><div class="tco-legend-item"><div class="tco-legend-dot" style="background:#FF6F00;"></div>Sodium-ion</div></div></div><div class="tco-breakdown"><h4>&#128176; 10-Year Cost Comparison</h4><p><strong style="color:#9E9E9E;">Lead-acid (500 cycles):</strong></p><p>&#8226; Replace every 2-3 years</p><p>&#8226; 3-4 replacements needed</p><p>&#8226; Total: 3-4x initial cost</p><p style="margin-top:0.8rem;"><strong style="color:#FF6F00;">Sodium-ion (3,000+ cycles):</strong></p><p>&#8226; One-time installation</p><p>&#8226; No replacement for 10+ years</p><p>&#8226; Total: 1x initial cost</p><p class="highlight-text">&#128271; Savings: 50-60% over 10 years</p></div></div><div class="roi-metrics"><div class="roi-item"><div class="value" style="color:var(--blue);">50-60%</div><div class="label">10-Year Cost Savings<br>vs. Lead-acid</div></div><div class="roi-item"><div class="value" style="color:var(--teal);">< 2 Years</div><div class="label">Payback Period<br>vs. LFP batteries</div></div><div class="roi-item"><div class="value" style="color:var(--orange);">3,000+</div><div class="label">Cycle Life<br>@ 80% DoD</div></div><div class="roi-item"><div class="value" style="color:var(--green);">10+ Years</div><div class="label">Service Life<br>No replacement needed</div></div><div class="roi-item"><div class="value" style="color:var(--purple);">30-40%</div><div class="label">Cost Reduction<br>vs. LFP per kWh</div></div></div></div></section><section id="applications"><div class="container"><h2 class="section-title">UPS Application Scenarios</h2><p class="section-subtitle">Where sodium-ion delivers the most value for UPS backup power</p><div class="apps-grid"><div class="app-card" style="border-top-color:var(--blue);"><div class="icon">&#127970;</div><h3 style="color:var(--blue);">Data Center UPS</h3><ul><li>24/7 critical load protection</li><li>Zero fire risk for server rooms</li><li>Space-efficient, no HVAC needed</li><li>Fast recharge between outages</li></ul></div><div class="app-card" style="border-top-color:var(--teal);"><div class="icon">&#128241;</div><h3 style="color:var(--teal);">Telecom Base Station UPS</h3><ul><li>Remote sites with extreme temps</li><li>-20&#176;C to 60&#176;C operation</li><li>Low maintenance for rural areas</li><li>10+ year service life</li></ul></div><div class="app-card" style="border-top-color:var(--orange);"><div class="icon">&#127997;</div><h3 style="color:var(--orange);">Industrial UPS</h3><ul><li>Factory automation backup</li><li>High-temperature workshops</li><li>Heavy load support (2C discharge)</li><li>Reliable for critical processes</li></ul></div><div class="app-card" style="border-top-color:var(--red);"><div class="icon">&#128657;</div><h3 style="color:var(--red);">Medical Facility UPS</h3><ul><li>Life-critical equipment backup</li><li>Zero fire risk compliance</li><li>Silent, vibration-free operation</li><li>Instant power switching</li></ul></div><div class="app-card" style="border-top-color:var(--green);"><div class="icon">&#127968;</div><h3 style="color:var(--green);">Home & Office UPS</h3><ul><li>Home office backup power</li><li>Solar + storage integration</li><li>Compact, wall-mountable design</li><li>Cost-effective solution</li></ul></div><div class="app-card" style="border-top-color:var(--purple);"><div class="icon">&#127796;</div><h3 style="color:var(--purple);">Off-Grid & Remote UPS</h3><ul><li>Remote monitoring stations</li><li>Rural electrification backup</li><li>Microgrid energy storage</li><li>No regular maintenance needed</li></ul></div></div></div></section><section id="specs"><div class="container"><h2 class="section-title">Technical Specifications</h2><p class="section-subtitle">Talegent 6.4Ah Sodium-ion Module &#8212; Designed for seamless UPS integration</p><div class="specs-grid"><div><table class="specs-table"><tr><td>Battery Chemistry</td><td>Sodium-ion (Na-ion)</td></tr><tr><td>Configuration</td><td>4S (4 cells in series)</td></tr><tr><td>Nominal Voltage</td><td>12.8V</td></tr><tr><td>Nominal Capacity</td><td>6.4Ah</td></tr><tr><td>Nominal Energy</td><td>81.92Wh</td></tr><tr><td>Operating Voltage</td><td>10.0V ~ 14.6V</td></tr><tr><td>Standard Charge</td><td>0.2C (1.28A)</td></tr><tr><td>Max Charge (Fast)</td><td>1C (6.4A) &#8212; 30min to 80%</td></tr><tr><td>Max Discharge (UPS)</td><td>2C (12.8A) &#8212; peak load support</td></tr><tr><td>Operating Temp</td><td>-20&#176;C ~ 60&#176;C</td></tr><tr><td>Cycle Life</td><td>&#8805; 3,000 cycles @ 80% DoD</td></tr><tr><td>Communication</td><td>RS485 / CAN / I&#178;C</td></tr><tr><td>Dimensions</td><td>150 &#215; 65 &#215; 95 mm</td></tr><tr><td>Weight</td><td>~1.2 kg</td></tr><tr><td>Certification</td><td>UN38.3, CE, RoHS</td></tr></table></div><div class="integration-list"><h3>&#128268; UPS Integration Features</h3><ul><li>Drop-in replacement for lead-acid (same 12.8V)</li><li>Compatible with standard UPS charging profiles</li><li>BMS communicates via RS485/CAN with UPS controller</li><li>Real-time battery status: voltage, current, temp, SOC</li><li>Automatic load shedding at low SOC</li><li>Parallel connection for higher capacity (up to 4 units)</li><li>Hot-swappable module design for easy maintenance</li><li>LED indicators: Power, Charging, Fault, SOC level</li><li>Remote monitoring via Modbus protocol</li><li>Firmware upgradeable via CAN bus</li></ul><p style="margin-top:1rem;padding:0.8rem;background:var(--navy);color:white;border-radius:8px;text-align:center;font-weight:600;">&#128161; Same voltage as lead-acid &#8212; no UPS modification needed!</p></div></div></div></section><section class="cta-section" id="contact"><h2>Ready to Upgrade Your UPS?</h2><p>Contact Talegent today for a free consultation and product demo</p><div class="cta-buttons"><a href="https://wa.me/8618163813252?text=Hello%2C%20I%20am%20interested%20in%20your%20UPS%20products." target="_blank" class="btn btn-whatsapp" style="font-size:1.1rem;padding:16px 36px;">&#128172; Chat on WhatsApp</a><a href="mailto:dean@talegent-ess.com" class="btn btn-primary" style="font-size:1.1rem;padding:16px 36px;">&#9993; Email: dean@talegent-ess.com</a></div></section><footer><p>&#169; 2026 Talegent. All rights reserved. | Sodium-ion UPS Solution | <a href="mailto:dean@talegent-ess.com">dean@talegent-ess.com</a></p></footer><!-- WhatsApp Floating Button --><a href="https://wa.me/8618163813252?text=Hello%2C%20I%20am%20interested%20in%20your%20UPS%20products." target="_blank" class="whatsapp-float"> &#128172; <span class="tooltip">Chat with us!</span></a><script> function toggleMenu() { document.getElementById('navLinks').classList.toggle('active'); } // Close menu on link click document.querySelectorAll('.nav-links a').forEach(link => { link.addEventListener('click', () => { document.getElementById('navLinks').classList.remove('active'); }); }); </script><script src="/tracker-client.js"></script></body></html> `;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Talegent 数据仪表盘</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,sans-serif;background:#f0f2f5;color:#1a1a2e}
.header{background:linear-gradient(135deg,#0A1F44,#1A3A6A);color:#fff;padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
.header h1{font-size:1.4rem}
.header .subtitle{color:#88AACC;font-size:.85rem}
.header .controls{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.header .controls select,.header .controls input{padding:.4rem .6rem;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:.85rem}
.header .controls select option{color:#1a1a2e;background:#fff}
.header .controls button{padding:.4rem 1rem;border-radius:6px;border:none;background:#1A73E8;color:#fff;cursor:pointer;font-size:.85rem}
.header .controls button:hover{background:#1557B0}
.header .controls .refresh-btn{background:#009688}
.header .controls .refresh-btn:hover{background:#00796B}
.header .controls .export-btn{background:#FF6F00}
.header .controls .export-btn:hover{background:#E65100}
.header .last-update{color:#88AACC;font-size:.8rem}
.container{max-width:1400px;margin:0 auto;padding:1rem}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.8rem;margin-bottom:1rem}
.kpi-card{background:#fff;border-radius:10px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06);text-align:center}
.kpi-card .kpi-value{font-size:1.8rem;font-weight:800;color:#0A1F44}
.kpi-card .kpi-label{font-size:.8rem;color:#666;margin-top:.2rem}
.kpi-card.blue .kpi-value{color:#1A73E8}
.kpi-card.green .kpi-value{color:#009688}
.kpi-card.orange .kpi-value{color:#FF6F00}
.kpi-card.purple .kpi-value{color:#6A1B9A}
.kpi-card.red .kpi-value{color:#C62828}
.kpi-card.teal .kpi-value{color:#00897B}
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}
.chart-card{background:#fff;border-radius:10px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.chart-card.full{grid-column:1/-1}
.chart-card h3{font-size:.95rem;color:#0A1F44;margin-bottom:.5rem}
.chart-card .chart-wrapper{position:relative;height:250px}
.chart-card .chart-wrapper.tall{height:300px}
.chart-card .chart-wrapper.short{height:200px}
.dist-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin-bottom:1rem}
.dist-card{background:#fff;border-radius:10px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.dist-card h3{font-size:.9rem;color:#0A1F44;margin-bottom:.3rem;text-align:center}
.dist-card .chart-wrapper{position:relative;height:200px}
.hot-pages{background:#fff;border-radius:10px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:1rem}
.hot-pages h3{font-size:.95rem;color:#0A1F44;margin-bottom:.5rem}
.hot-pages table{width:100%;border-collapse:collapse;font-size:.85rem}
.hot-pages th{background:#f5f7fa;padding:.5rem;text-align:left;font-weight:600;color:#0A1F44}
.hot-pages td{padding:.4rem .5rem;border-bottom:1px solid #f0f0f0}
.hot-pages tr:hover td{background:#f8f9ff}
.hot-pages .rank{font-weight:700;color:#1A73E8;width:30px;text-align:center}
.events-section{background:#fff;border-radius:10px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:1rem}
.events-section .header-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem}
.events-section .header-row h3{font-size:.95rem;color:#0A1F44}
.events-section .filters{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.events-section .filters select,.events-section .filters input{padding:.3rem .5rem;border-radius:6px;border:1px solid #ddd;font-size:.8rem}
.table-wrapper{overflow-x:auto}
.events-table{width:100%;border-collapse:collapse;font-size:.8rem}
.events-table th{background:#f5f7fa;padding:.5rem;text-align:left;font-weight:600;color:#0A1F44;white-space:nowrap;position:sticky;top:0}
.events-table td{padding:.4rem .5rem;border-bottom:1px solid #f0f0f0;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}
.events-table tr:hover td{background:#f8f9ff}
.events-table .event-type{display:inline-block;padding:.15rem .5rem;border-radius:10px;font-size:.7rem;font-weight:600}
.event-pageview{background:#E3F2FD;color:#1565C0}
.event-click{background:#FFF3E0;color:#E65100}
.event-whatsapp{background:#E8F5E9;color:#2E7D32}
.event-email{background:#F3E5F5;color:#7B1FA2}
.event-scroll{background:#E0F7FA;color:#00838F}
.event-time_on_page{background:#FBE9E7;color:#BF360C}
.event-pageleave{background:#ECEFF1;color:#455A64}
.events-table .expand-btn{cursor:pointer;color:#1A73E8;font-size:.75rem}
.events-table .detail-row{display:none}
.events-table .detail-row td{background:#fafafa;padding:.5rem 1rem}
.events-table .detail-row pre{font-size:.7rem;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-all}
.loading{text-align:center;padding:3rem;color:#666}
.loading .spinner{display:inline-block;width:40px;height:40px;border:4px solid #e0e0e0;border-top-color:#1A73E8;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:1rem}
@keyframes spin{to{transform:rotate(360deg)}}
.error{text-align:center;padding:2rem;color:#C62828;background:#FFEBEE;border-radius:10px;margin:1rem 0}
@media(max-width:768px){.charts-row{grid-template-columns:1fr}.kpi-grid{grid-template-columns:repeat(2,1fr)}.header{padding:.8rem 1rem}.header h1{font-size:1.1rem}.kpi-card .kpi-value{font-size:1.4rem}.chart-card .chart-wrapper{height:200px}.dist-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.kpi-grid{grid-template-columns:1fr 1fr;gap:.5rem}.kpi-card{padding:.6rem}.kpi-card .kpi-value{font-size:1.2rem}.dist-row{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="header">
  <div><h1>📊 Talegent 数据仪表盘</h1><div class="subtitle">Sodium UPS 网站访问分析</div></div>
  <div class="controls">
    <span class="last-update" id="lastUpdate">最后更新：--</span>
    <select id="dateRange"><option value="7">近7天</option><option value="30" selected>近30天</option><option value="90">近90天</option></select>
    <button class="refresh-btn" onclick="refreshData()">🔄 刷新</button>
    <button class="export-btn" onclick="exportCSV()">📥 导出CSV</button>
  </div>
</div>
<div class="container">
  <div id="loading" class="loading"><div class="spinner"></div><div>正在加载数据...</div></div>
  <div id="error" class="error" style="display:none;"></div>
  <div id="dashboard" style="display:none;">
    <div class="kpi-grid" id="kpiGrid"></div>
    <div class="charts-row"><div class="chart-card full"><h3>📈 PV/UV 趋势</h3><div class="chart-wrapper tall"><canvas id="trendChart"></canvas></div></div></div>
    <div class="charts-row">
      <div class="chart-card"><h3>🕐 按小时分布</h3><div class="chart-wrapper"><canvas id="hourlyChart"></canvas></div></div>
      <div class="chart-card"><h3>📊 每日事件总量</h3><div class="chart-wrapper"><canvas id="dailyEventsChart"></canvas></div></div>
    </div>
    <div class="dist-row">
      <div class="dist-card"><h3>🌍 地区分布</h3><div class="chart-wrapper short"><canvas id="countryChart"></canvas></div></div>
      <div class="dist-card"><h3>📱 设备类型</h3><div class="chart-wrapper short"><canvas id="deviceChart"></canvas></div></div>
      <div class="dist-card"><h3>💻 操作系统</h3><div class="chart-wrapper short"><canvas id="osChart"></canvas></div></div>
      <div class="dist-card"><h3>🌐 浏览器</h3><div class="chart-wrapper short"><canvas id="browserChart"></canvas></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-card"><h3>🔗 来源渠道</h3><div class="chart-wrapper short"><canvas id="referrerChart"></canvas></div></div>
      <div class="chart-card"><h3>📋 事件类型分布</h3><div class="chart-wrapper short"><canvas id="eventTypeChart"></canvas></div></div>
    </div>
    <div class="hot-pages" id="hotPages"></div>
    <div class="events-section">
      <div class="header-row">
        <h3>📝 详细事件记录</h3>
        <div class="filters">
          <select id="eventTypeFilter" onchange="filterEvents()">
            <option value="">全部类型</option><option value="pageview">页面浏览</option><option value="click">点击</option>
            <option value="whatsapp_click">WhatsApp</option><option value="email_click">邮件</option>
            <option value="scroll">滚动</option><option value="time_on_page">停留</option><option value="pageleave">离开</option>
          </select>
          <input type="date" id="dateFrom" onchange="filterEvents()">
          <input type="date" id="dateTo" onchange="filterEvents()">
        </div>
      </div>
      <div class="table-wrapper">
        <table class="events-table">
          <thead><tr><th>时间</th><th>类型</th><th>访客ID</th><th>地区</th><th>设备</th><th>浏览器</th><th>停留(秒)</th><th>页面</th><th></th></tr></thead>
          <tbody id="eventsBody"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<script>
const TOKEN='talegent_admin_2026';
const API_BASE="https://talegent-tracker-api.tanyong2396.workers.dev";
let allEvents=[];
let charts={};

function escapeHtml(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}

async function fetchData(){
  var r=await fetch(API_BASE+'/api/events?token='+TOKEN+'&limit=1000');
  if(!r.ok)throw new Error('HTTP '+r.status);
  var d=await r.json();
  allEvents=d.events||[];
  document.getElementById('lastUpdate').textContent='最后更新：'+new Date().toLocaleString('zh-CN');
  return allEvents
}

function processData(events,days){
  var now=new Date(),cutoff=new Date(now.getTime()-days*86400000);
  var filtered=events.filter(function(e){return new Date(e.timestamp)>=cutoff});
  var totalPV=filtered.filter(function(e){return e.event_type==='pageview'||e.eventType==='pageview'}).length;
  var today=new Date().toISOString().split('T')[0];
  var todayPV=filtered.filter(function(e){var d=(e.timestamp||'').split('T')[0];return d===today&&(e.event_type==='pageview'||e.eventType==='pageview')}).length;
  var allVis=new Set(),todayVis=new Set();
  filtered.forEach(function(e){var v=e.visitor_id||e.visitorId;if(v)allVis.add(v);var d=(e.timestamp||'').split('T')[0];if(d===today&&v)todayVis.add(v)});
  var pvs=filtered.filter(function(e){return e.event_type==='pageview'||e.eventType==='pageview'});
  var avgTime=0;
  if(pvs.length>0){var t=0;pvs.forEach(function(e){t+=e.time_on_page||e.timeOnPage||0});avgTime=Math.round(t/pvs.length/1000)}
  var sess={};
  filtered.forEach(function(e){var s=e.session_id||e.sessionId;if(s){if(!sess[s])sess[s]=[];sess[s].push(e)}});
  var sKeys=Object.keys(sess),bounced=0;
  sKeys.forEach(function(s){if(sess[s].length<=1)bounced++});
  var bounceRate=sKeys.length>0?Math.round(bounced/sKeys.length*100):0;
  var pages={};
  filtered.forEach(function(e){var u=e.url||'';if(u)pages[u]=(pages[u]||0)+1});
  var hotPages=Object.entries(pages).sort(function(a,b){return b[1]-a[1]}).slice(0,5);
  var daily={};
  for(var i=0;i<days;i++){var d=new Date(now.getTime()-i*86400000).toISOString().split('T')[0];daily[d]={pv:0,uv:new Set()}}
  filtered.forEach(function(e){var d=(e.timestamp||'').split('T')[0];if(daily[d]){daily[d].pv++;var v=e.visitor_id||e.visitorId;if(v)daily[d].uv.add(v)}});
  var dl=Object.keys(daily).sort();
  var dpv=dl.map(function(d){return daily[d].pv});
  var duv=dl.map(function(d){return daily[d].uv.size});
  var hourly=Array(24).fill(0);
  filtered.forEach(function(e){var h=parseInt((e.timestamp||'').split('T')[1]?.split(':')[0]);if(h>=0&&h<24)hourly[h]++});
  var de={};
  filtered.forEach(function(e){var d=(e.timestamp||'').split('T')[0];de[d]=(de[d]||0)+1});
  var deLabels=Object.keys(de).sort().slice(-days);
  var deValues=deLabels.map(function(d){return de[d]});
  var countries={},devices={},osDist={},browsers={};
  filtered.forEach(function(e){var c=e.country||'unknown';countries[c]=(countries[c]||0)+1;var d=e.device_type||e.deviceType||'unknown';devices[d]=(devices[d]||0)+1;var o=e.os||'unknown';osDist[o]=(osDist[o]||0)+1;var b=e.browser||'unknown';browsers[b]=(browsers[b]||0)+1});
  var refs={};
  filtered.forEach(function(e){
    var r=e.referrer||'(direct)',cat='direct';
    if(r!=='(direct)'&&r!==''){
      if(r.indexOf('google')!==-1||r.indexOf('baidu')!==-1||r.indexOf('bing')!==-1)cat='search';
      else if(r.indexOf('facebook')!==-1||r.indexOf('twitter')!==-1||r.indexOf('linkedin')!==-1||r.indexOf('instagram')!==-1)cat='social';
      else if(r.indexOf('mail')!==-1||r.indexOf('outlook')!==-1)cat='email';
      else cat='other'
    }
    refs[cat]=(refs[cat]||0)+1
  });
  var ets={};
  filtered.forEach(function(e){var et=e.event_type||e.eventType||'unknown';ets[et]=(ets[et]||0)+1});
  var wa=filtered.filter(function(e){return e.event_type==='whatsapp_click'||e.eventType==='whatsapp_click'}).length;
  var em=filtered.filter(function(e){return e.event_type==='email_click'||e.eventType==='email_click'}).length;
  var sdurs={};
  filtered.forEach(function(e){var s=e.session_id||e.sessionId;if(s){var d=e.time_on_page||e.timeOnPage||e.duration||0;if(!sdurs[s])sdurs[s]={c:0,t:0};sdurs[s].c++;sdurs[s].t+=d}});
  var avgSess=0,sdKeys=Object.keys(sdurs);
  if(sdKeys.length>0){var ta=0;sdKeys.forEach(function(s){ta+=sdurs[s].t/sdurs[s].c});avgSess=Math.round(ta/sdKeys.length/1000)}
  return{totalPV,todayPV,totalUV:allVis.size,todayUV:todayVis.size,avgTime,bounceRate,hotPages,dailyLabels:dl,dailyPV:dpv,dailyUV:duv,hourly,deLabels,deValues,countries,devices,osDist,browsers,referrers:refs,eventTypes:ets,whatsappClicks:wa,emailClicks:em,avgSessionDuration:avgSess}
}

function renderKPI(s){
  document.getElementById('kpiGrid').innerHTML=
    '<div class="kpi-card blue"><div class="kpi-value">'+s.totalPV+'</div><div class="kpi-label">总访问量 (PV)</div></div>'+
    '<div class="kpi-card green"><div class="kpi-value">'+s.todayPV+'</div><div class="kpi-label">今日访问量</div></div>'+
    '<div class="kpi-card purple"><div class="kpi-value">'+s.totalUV+'</div><div class="kpi-label">独立访客 (UV)</div></div>'+
    '<div class="kpi-card orange"><div class="kpi-value">'+s.todayUV+'</div><div class="kpi-label">今日访客</div></div>'+
    '<div class="kpi-card teal"><div class="kpi-value">'+s.avgTime+'s</div><div class="kpi-label">平均停留时长</div></div>'+
    '<div class="kpi-card red"><div class="kpi-value">'+s.bounceRate+'%</div><div class="kpi-label">跳出率</div></div>'+
    '<div class="kpi-card blue"><div class="kpi-value">'+s.avgSessionDuration+'s</div><div class="kpi-label">平均会话时长</div></div>'+
    '<div class="kpi-card green"><div class="kpi-value">'+s.whatsappClicks+'</div><div class="kpi-label">WhatsApp点击</div></div>'
}

function renderHotPages(s){
  var d=document.getElementById('hotPages');
  if(s.hotPages.length===0){d.innerHTML='<h3>🔥 最热页面</h3><p style="color:#999;font-size:.85rem;">暂无数据</p>';return}
  var h='<h3>🔥 最热页面 TOP 5</h3><table><thead><tr><th>#</th><th>URL</th><th>访问量</th></tr></thead><tbody>';
  for(var i=0;i<s.hotPages.length;i++)h+='<tr><td class="rank">'+(i+1)+'</td><td>'+escapeHtml(s.hotPages[i][0])+'</td><td>'+s.hotPages[i][1]+'</td></tr>';
  d.innerHTML=h+'</tbody></table>'
}

function renderTrendChart(s){
  if(charts.trend)charts.trend.destroy();
  charts.trend=new Chart(document.getElementById('trendChart').getContext('2d'),{
    type:'line',data:{labels:s.dailyLabels,datasets:[
      {label:'PV',data:s.dailyPV,borderColor:'#1A73E8',backgroundColor:'rgba(26,115,232,0.1)',fill:true,tension:.3,pointRadius:3},
      {label:'UV',data:s.dailyUV,borderColor:'#FF6F00',backgroundColor:'rgba(255,111,0,0.1)',fill:true,tension:.3,pointRadius:3}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  })
}

function renderHourlyChart(s){
  if(charts.hourly)charts.hourly.destroy();
  var lb=[];for(var i=0;i<24;i++)lb.push(i+'时');
  charts.hourly=new Chart(document.getElementById('hourlyChart').getContext('2d'),{
    type:'line',data:{labels:lb,datasets:[{label:'访问量',data:s.hourly,borderColor:'#009688',backgroundColor:'rgba(0,150,136,0.1)',fill:true,tension:.3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  })
}

function renderDailyEventsChart(s){
  if(charts.dailyEvents)charts.dailyEvents.destroy();
  charts.dailyEvents=new Chart(document.getElementById('dailyEventsChart').getContext('2d'),{
    type:'bar',data:{labels:s.deLabels,datasets:[{label:'事件数',data:s.deValues,backgroundColor:'rgba(106,27,154,0.6)',borderColor:'#6A1B9A',borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  })
}

function renderPieChart(id,labels,data){
  if(charts[id])charts[id].destroy();
  var colors=['#1A73E8','#FF6F00','#009688','#6A1B9A','#C62828','#2E7D32','#FDD835','#8D6E63','#78909C','#E91E63'];
  charts[id]=new Chart(document.getElementById(id).getContext('2d'),{
    type:'doughnut',data:{labels:labels,datasets:[{data:data,backgroundColor:colors}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:10},boxWidth:12}}}}
  })
}

function renderDistCharts(s){
  var c=Object.entries(s.countries).sort(function(a,b){return b[1]-a[1]}).slice(0,8);
  renderPieChart('countryChart',c.map(function(d){return d[0]}),c.map(function(d){return d[1]}));
  var d=Object.entries(s.devices).sort(function(a,b){return b[1]-a[1]});
  renderPieChart('deviceChart',d.map(function(d){return d[0]}),d.map(function(d){return d[1]}));
  var o=Object.entries(s.osDist).sort(function(a,b){return b[1]-a[1]}).slice(0,6);
  renderPieChart('osChart',o.map(function(d){return d[0]}),o.map(function(d){return d[1]}));
  var b=Object.entries(s.browsers).sort(function(a,b){return b[1]-a[1]}).slice(0,6);
  renderPieChart('browserChart',b.map(function(d){return d[0]}),b.map(function(d){return d[1]}));
  var r=Object.entries(s.referrers).sort(function(a,b){return b[1]-a[1]});
  renderPieChart('referrerChart',r.map(function(d){return d[0]}),r.map(function(d){return d[1]}));
  var e=Object.entries(s.eventTypes).sort(function(a,b){return b[1]-a[1]});
  renderPieChart('eventTypeChart',e.map(function(d){return d[0]}),e.map(function(d){return d[1]}))
}

function filterEvents(){renderEventsTable(allEvents)}

function renderEventsTable(events){
  var tb=document.getElementById('eventsBody');
  var tf=document.getElementById('eventTypeFilter').value;
  var df=document.getElementById('dateFrom').value;
  var dt=document.getElementById('dateTo').value;
  var f=events.slice();
  if(tf)f=f.filter(function(e){return(e.event_type||e.eventType)===tf});
  if(df)f=f.filter(function(e){return(e.timestamp||'').split('T')[0]>=df});
  if(dt)f=f.filter(function(e){return(e.timestamp||'').split('T')[0]<=dt});
  f.sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp)});
  f=f.slice(0,100);
  if(f.length===0){tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:#999;padding:2rem;">暂无数据</td></tr>';return}
  var h='';
  for(var i=0;i<f.length;i++){
    var e=f[i],et=e.event_type||e.eventType||'unknown',cls='';
    if(et.indexOf('whatsapp')!==-1)cls='event-whatsapp';else if(et.indexOf('email')!==-1)cls='event-email';
    else if(et==='pageview')cls='event-pageview';else if(et==='click')cls='event-click';
    else if(et==='scroll')cls='event-scroll';else if(et==='time_on_page')cls='event-time_on_page';
    else if(et==='pageleave')cls='event-pageleave';
    var t=e.timestamp?new Date(e.timestamp).toLocaleString('zh-CN'):'-';
    var vid=(e.visitor_id||e.visitorId||'-').substring(0,16);
    var dur=e.time_on_page||e.timeOnPage||e.duration||0;
    var ds=dur>0?Math.round(dur/1000):'-';
    var url=e.url||'-',ud=url.length>40?url.substring(0,40)+'...':url;
    h+='<tr><td>'+t+'</td><td><span class="event-type '+cls+'">'+et+'</span></td>'+
      '<td title="'+escapeHtml(e.visitor_id||e.visitorId||'')+'">'+escapeHtml(vid)+'</td>'+
      '<td>'+(e.country||'-')+'</td><td>'+(e.device_type||e.deviceType||'-')+'</td>'+
      '<td>'+(e.browser||'-')+'</td><td>'+ds+'</td>'+
      '<td title="'+escapeHtml(url)+'">'+escapeHtml(ud)+'</td>'+
      '<td><span class="expand-btn" onclick="toggleDetail('+i+')">▶</span></td></tr>'+
      '<tr class="detail-row" id="detail-'+i+'"><td colspan="9"><pre>'+escapeHtml(JSON.stringify(e,null,2))+'</pre></td></tr>'
  }
  tb.innerHTML=h
}

function toggleDetail(i){var r=document.getElementById('detail-'+i);r.style.display=r.style.display==='table-row'?'none':'table-row'}

function exportCSV(){
  if(allEvents.length===0)return;
  var csv='时间,类型,访客ID,地区,设备,浏览器,停留(秒),页面,事件类型\n';
  allEvents.forEach(function(e){
    var t=e.timestamp?new Date(e.timestamp).toLocaleString('zh-CN'):'';
    var et=e.event_type||e.eventType||'';
    var vid=e.visitor_id||e.visitorId||'';
    var c=e.country||'';
    var d=e.device_type||e.deviceType||'';
    var b=e.browser||'';
    var dur=e.time_on_page||e.timeOnPage||e.duration||0;
    var ds=dur>0?Math.round(dur/1000):'';
    var url=e.url||'';
    csv+=t+','+et+','+vid+','+c+','+d+','+b+','+ds+','+url+','+et+'\n'
  });
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='talegent_events.csv';a.click()
}

async function refreshData(){
  document.getElementById('loading').style.display='block';
  document.getElementById('dashboard').style.display='none';
  document.getElementById('error').style.display='none';
  try{
    var events=await fetchData();
    var days=parseInt(document.getElementById('dateRange').value);
    var stats=processData(events,days);
    renderKPI(stats);
    renderHotPages(stats);
    renderTrendChart(stats);
    renderHourlyChart(stats);
    renderDailyEventsChart(stats);
    renderDistCharts(stats);
    renderEventsTable(events);
    document.getElementById('loading').style.display='none';
    document.getElementById('dashboard').style.display='block'
  }catch(err){
    document.getElementById('loading').style.display='none';
    document.getElementById('error').style.display='block';
    document.getElementById('error').innerHTML='<strong>❌ 加载失败</strong><div class="detail">'+err.message+'</div>'
  }
}

document.getElementById('dateRange').addEventListener('change',function(){
  var days=parseInt(this.value);
  var stats=processData(allEvents,days);
  renderKPI(stats);
  renderHotPages(stats);
  renderTrendChart(stats);
  renderHourlyChart(stats);
  renderDailyEventsChart(stats);
  renderDistCharts(stats)
});

refreshData();
setInterval(refreshData,60000);
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Serve tracker-client.js
    if (path === "/tracker-client.js") {
      return new Response(TRACKER_CLIENT_JS, {
        headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache, max-age=0" },
      });
    }

    // Serve dashboard
    if (path === "/dashboard" || path === "/dashboard/") {
      return new Response(DASHBOARD_HTML, {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    // Serve index.html
    if (path === "/" || path === "") {
      return new Response(INDEX_HTML, {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    // POST /api/track - receive tracking data
    if (request.method === "POST" && path === "/api/track") {
      try {
        const rawText = await request.text();
        let data = JSON.parse(rawText);
        data.timestamp = new Date().toISOString();
        data.id = crypto.randomUUID();
        data.country = request.headers.get("CF-IPCountry") || "unknown";
        data.city = request.headers.get("CF-IPCity") || "unknown";

        // 兼容 camelCase 和 snake_case 字段名
        data.visitor_id = data.visitor_id || data.visitorId || "";
        data.session_id = data.session_id || data.sessionId || "";
        data.event_type = data.event_type || data.eventType || "";
        data.device_type = data.device_type || data.deviceType || "";
        data.time_on_page = data.time_on_page || data.timeOnPage || 0;
        data.site_name = data.site_name || data.siteName || "";
        data.site_version = data.site_version || data.siteVersion || "";

        if (env.VISITOR_DATA) {
          const key = "evt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
          await env.VISITOR_DATA.put(key, JSON.stringify(data));

          // 维护最新事件列表缓存（最多50条）
          const MAX_CACHED_EVENTS = 50;
          let latestEvents = [];
          try {
            const cached = await env.VISITOR_DATA.get("latest_events");
            if (cached) latestEvents = JSON.parse(cached);
          } catch(e) {}
          // 新事件插入到最前面
          latestEvents.unshift(data);
          // 只保留最新的 MAX_CACHED_EVENTS 条
          if (latestEvents.length > MAX_CACHED_EVENTS) {
            latestEvents = latestEvents.slice(0, MAX_CACHED_EVENTS);
          }
          await env.VISITOR_DATA.put("latest_events", JSON.stringify(latestEvents));

          const dateStr = new Date().toISOString().split("T")[0];
          const currentPV = parseInt(await env.VISITOR_DATA.get("stats_pv") || "0");
          await env.VISITOR_DATA.put("stats_pv", (currentPV + 1).toString());

          const currentDaily = parseInt(await env.VISITOR_DATA.get("stats_daily_pv:" + dateStr) || "0");
          await env.VISITOR_DATA.put("stats_daily_pv:" + dateStr, (currentDaily + 1).toString());

          if (data.visitor_id) {
            const uvSet = await env.VISITOR_DATA.get("stats_uv:" + dateStr) || "[]";
            const uvList = JSON.parse(uvSet);
            if (!uvList.includes(data.visitor_id)) {
              uvList.push(data.visitor_id);
              await env.VISITOR_DATA.put("stats_uv:" + dateStr, JSON.stringify(uvList));
            }
          }
        }

        return new Response(JSON.stringify({ success: true, id: data.id }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    // GET /api/stats - summary statistics
    if (request.method === "GET" && path === "/api/stats") {
      const token = url.searchParams.get("token");
      if (token !== "talegent_admin_2026") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      try {
        const totalPV = parseInt(await env.VISITOR_DATA.get("stats_pv") || "0");
        const dateStr = new Date().toISOString().split("T")[0];
        const todayPV = parseInt(await env.VISITOR_DATA.get("stats_daily_pv:" + dateStr) || "0");
        const todayUV = JSON.parse(await env.VISITOR_DATA.get("stats_uv:" + dateStr) || "[]").length;

        return new Response(JSON.stringify({ total_page_views: totalPV, today_page_views: todayPV, today_unique_visitors: todayUV }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // GET /api/events - detailed event records
    if (request.method === "GET" && path === "/api/events") {
      const token = url.searchParams.get("token");
      if (token !== "talegent_admin_2026") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      try {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const type = url.searchParams.get("type") || "";

        // 直接从 latest_events 缓存读取（O(1) 复杂度，毫秒级响应）
        let events = [];
        try {
          const cached = await env.VISITOR_DATA.get("latest_events");
          if (cached) events = JSON.parse(cached);
        } catch(e) {}

        // 按事件类型过滤
        if (type) {
          events = events.filter(e => e.event_type === type || e.eventType === type);
        }

        // 按时间戳降序排序（缓存本身已排序，但做一次保障）
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // 只取最新的 limit 条
        events = events.slice(0, limit);

        return new Response(JSON.stringify({ total: events.length, events: events }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
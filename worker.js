// ============================================================
// Cloudflare Worker - Talegent Analytics API (Server Side)
// Receives data from tracker-client.js, stores in KV
// Compliant with GDPR & China Personal Information Protection Law
// ============================================================

export default {
  async fetch(request, env) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ============================================================
    // POST /api/track - 接收追踪数据并写入 KV
    // ============================================================
    if (request.method === 'POST' && path === '/api/track') {
      try {
        const data = await request.json();
        data.timestamp = new Date().toISOString();
        data.id = crypto.randomUUID();

        // 获取 Cloudflare 提供的地理位置信息（不存储原始 IP）
        data.country = request.headers.get('CF-IPCountry') || 'unknown';
        data.city = request.headers.get('CF-IPCity') || 'unknown';

        if (env.VISITOR_DATA) {
          // 1. 存储原始事件
          const key = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await env.VISITOR_DATA.put(key, JSON.stringify(data));

          // 2. 更新总 PV
          const dateStr = new Date().toISOString().split('T')[0];
          const pvKey = 'stats_pv';
          const currentPV = parseInt(await env.VISITOR_DATA.get(pvKey) || '0');
          await env.VISITOR_DATA.put(pvKey, (currentPV + 1).toString());

          // 3. 更新每日 PV
          const dailyPVKey = `stats_daily_pv:${dateStr}`;
          const currentDaily = parseInt(await env.VISITOR_DATA.get(dailyPVKey) || '0');
          await env.VISITOR_DATA.put(dailyPVKey, (currentDaily + 1).toString());

          // 4. 更新每日 UV（去重）
          if (data.visitor_id) {
            const uvKey = `stats_uv:${dateStr}`;
            const uvSet = await env.VISITOR_DATA.get(uvKey) || '[]';
            const uvList = JSON.parse(uvSet);
            if (!uvList.includes(data.visitor_id)) {
              uvList.push(data.visitor_id);
              await env.VISITOR_DATA.put(uvKey, JSON.stringify(uvList));
            }
          }
        }

        return new Response(JSON.stringify({ success: true, id: data.id }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // ============================================================
    // GET / - 显示首页状态
    // ============================================================
    if (path === '/' || path === '') {
      let totalPV = 0;
      try {
        if (env.VISITOR_DATA) {
          totalPV = parseInt(await env.VISITOR_DATA.get('stats_pv') || '0');
        }
      } catch (e) {}

      return new Response(`
        <html>
          <head><title>Talegent Analytics</title></head>
          <body style="font-family:sans-serif;padding:40px;background:#0A1F44;color:white;">
            <h1>📊 Talegent Sodium UPS Analytics</h1>
            <p>Status: Running ✅</p>
            <p>KV Storage: ${env.VISITOR_DATA ? 'Connected ✅' : 'Not configured ❌'}</p>
            <p>Total Page Views: ${totalPV}</p>
            <p><a href="/api/stats?token=talegent_admin_2026" style="color:#1A73E8;">View Dashboard</a></p>
            <hr style="border-color:#334466;margin:20px 0;">
            <p style="color:#88AACC;font-size:0.85rem;">
              Privacy: GDPR & PIPL compliant. No raw IPs stored.
            </p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // GET /api/stats - 简单统计
    if (request.method === 'GET' && path === '/api/stats') {
      const token = url.searchParams.get('token');
      if (token !== 'talegent_admin_2026') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const totalPV = parseInt(await env.VISITOR_DATA.get('stats_pv') || '0');
        const dateStr = new Date().toISOString().split('T')[0];
        const todayPV = parseInt(await env.VISITOR_DATA.get(`stats_daily_pv:${dateStr}`) || '0');
        const todayUV = JSON.parse(await env.VISITOR_DATA.get(`stats_uv:${dateStr}`) || '[]').length;

        return new Response(JSON.stringify({
          total_page_views: totalPV,
          today_page_views: todayPV,
          today_unique_visitors: todayUV,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
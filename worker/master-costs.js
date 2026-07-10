/* totalIT master costs — Cloudflare Worker.

   Single endpoint, /costs, backed by one KV record:
   - GET  → public. Returns the current live unit-cost overrides so every
     visitor's copy of the pricing tool prices off the same figures. The
     numbers aren't secret (services.js has always shipped them in a public
     repo) — this endpoint doesn't need to hide them, only writes need
     gating.
   - POST → password-gated via the MASTER_PASSWORD secret, checked here on
     the server. Replaces the stored unit-cost map and returns it. This is
     the only way live costs change; nothing else writes to this KV key.

   Deploy: see README.md → "Master costs page".
*/

const KV_KEY = 'costs';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    const url = new URL(request.url);
    if (url.pathname !== '/costs') return json({ error: 'Not found' }, 404);

    if (request.method === 'GET') {
      const stored = await env.MASTER_COSTS.get(KV_KEY, { type: 'json' });
      return json(stored || { units: {}, updatedAt: null });
    }

    if (request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!env.MASTER_PASSWORD || token !== env.MASTER_PASSWORD) {
        return json({ error: 'Unauthorized' }, 401);
      }

      let body;
      try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
      if (!body || typeof body.units !== 'object' || body.units === null) {
        return json({ error: 'Bad request' }, 400);
      }

      const clean = {};
      for (const [key, val] of Object.entries(body.units)) {
        const n = Number(val);
        if (Number.isFinite(n) && n >= 0) clean[key] = n;
      }

      const record = { units: clean, updatedAt: new Date().toISOString() };
      await env.MASTER_COSTS.put(KV_KEY, JSON.stringify(record));
      return json(record);
    }

    return json({ error: 'Method not allowed' }, 405);
  },
};

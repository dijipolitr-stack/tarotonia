// /api/admin/stats.js
// Admin endpoint to check code stats and list recent codes

const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Get all code keys
    const keys = [];
    let cursor = 0;
    do {
      const result = await kv.scan(cursor, { match: 'code:*', count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0);

    // Get all code data
    const stats = { total: 0, unused: 0, in_use: 0, used: 0, by_spread: {} };
    const codes = [];

    for (const key of keys) {
      const data = await kv.get(key);
      if (data) {
        stats.total++;
        stats[data.status] = (stats[data.status] || 0) + 1;
        
        if (!stats.by_spread[data.spread_type]) {
          stats.by_spread[data.spread_type] = { total: 0, unused: 0, used: 0 };
        }
        stats.by_spread[data.spread_type].total++;
        stats.by_spread[data.spread_type][data.status === 'unused' ? 'unused' : 'used']++;
        
        codes.push({
          code: data.code,
          spread_type: data.spread_type,
          status: data.status,
          created_at: data.created_at,
          used_at: data.used_at || null
        });
      }
    }

    // Sort by created_at desc
    codes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ stats, recent_codes: codes.slice(0, 50) });

  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

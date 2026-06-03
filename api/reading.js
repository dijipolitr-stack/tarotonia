// /api/reading.js
// Proxies AI reading requests. Requires a valid session token tied to a paid,
// unused access code. Marks the code as permanently used upon success.
const { kv } = require('../lib/kv');

// One purchased code allows the main reading plus a follow-up question.
// A small buffer guards against transient retries. This hard-caps the total
// number of paid AI calls a single code can ever trigger.
const MAX_READINGS_PER_CODE = 3;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { system_prompt, user_prompt, max_tokens, session_token } = req.body;

    if (!system_prompt || !user_prompt) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // --- Access gate: a valid session token is mandatory ---
    if (!session_token || typeof session_token !== 'string') {
      return res.status(401).json({ error: 'Oturum bulunamadı / Session required' });
    }

    const sessionData = await kv.get(`session:${session_token}`);
    if (!sessionData || !sessionData.code) {
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum / Invalid or expired session' });
    }

    const codeData = await kv.get(`code:${sessionData.code}`);
    if (!codeData) {
      return res.status(404).json({ error: 'Kod bulunamadı / Code not found' });
    }

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Bu kodun süresi dolmuş / This code has expired' });
    }

    // Single-use enforcement: cap total AI calls per code. This bounds cost
    // across the main reading + follow-up, and across any extra sessions.
    const readingsDone = codeData.readings_done || 0;
    if (readingsDone >= MAX_READINGS_PER_CODE) {
      return res.status(410).json({ error: 'Bu kod zaten kullanılmış / This code has already been used' });
    }

    // Call Claude API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: max_tokens || 4000,
        system: system_prompt,
        messages: [{ role: 'user', content: user_prompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json().catch(() => ({}));
      console.error('Anthropic API error:', errorData);
      return res.status(502).json({ error: 'AI service error', details: errorData });
    }

    const aiData = await anthropicResponse.json();

    // Record the consumed reading. Once status is 'used', validate-code will
    // refuse to mint any new session for this code.
    try {
      await kv.set(`code:${sessionData.code}`, {
        ...codeData,
        status: 'used',
        readings_done: readingsDone + 1,
        used_at: codeData.used_at || new Date().toISOString()
      });
      await kv.set(`session:${session_token}`, {
        ...sessionData,
        readings_done: (sessionData.readings_done || 0) + 1
      }, { ex: 7200 });
    } catch (kvError) {
      // Don't fail the reading if KV update fails — log and continue
      console.error('KV update error (non-fatal):', kvError);
    }

    return res.status(200).json({
      success: true,
      content: aiData.content,
      usage: aiData.usage
    });

  } catch (error) {
    console.error('Reading API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

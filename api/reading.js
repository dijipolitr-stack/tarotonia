// /api/reading.js
// Proxies AI reading requests to Anthropic API
// API key stays secure on server - never exposed to browser

const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_token, system_prompt, user_prompt, max_tokens } = req.body;

    // Validate session token
    if (!session_token) {
      return res.status(401).json({ error: 'Oturum anahtarı gerekli / Session token required' });
    }

    const session = await kv.get(`session:${session_token}`);
    
    if (!session) {
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum / Invalid or expired session' });
    }

    // Check if reading limit reached (1 reading + 1 follow-up = max 2)
    if (session.readings_done >= 2) {
      return res.status(403).json({ error: 'Bu kod için okuma hakkınız kullanılmış / Reading already used for this code' });
    }

    // Validate required fields
    if (!system_prompt || !user_prompt) {
      return res.status(400).json({ error: 'Eksik parametreler / Missing parameters' });
    }

    // Call Anthropic API with server-side API key
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 4000,
        system: system_prompt,
        messages: [{ role: 'user', content: user_prompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json().catch(() => ({}));
      console.error('Anthropic API error:', errorData);
      return res.status(502).json({ error: 'AI servisi hatası / AI service error' });
    }

    const aiData = await anthropicResponse.json();

    // Mark reading as done (increment counter)
    await kv.set(`session:${session_token}`, {
      ...session,
      readings_done: (session.readings_done || 0) + 1,
      reading_completed_at: new Date().toISOString()
    }, { ex: 7200 });

    // Mark original code as used (only on first reading)
    if ((session.readings_done || 0) === 0) {
      const codeData = await kv.get(`code:${session.code}`);
      if (codeData) {
        await kv.set(`code:${session.code}`, {
          ...codeData,
          status: 'used',
          used_at: new Date().toISOString()
        });
      }
    }

    // Return AI response
    return res.status(200).json({
      success: true,
      content: aiData.content,
      usage: aiData.usage
    });

  } catch (error) {
    console.error('Reading API error:', error);
    return res.status(500).json({ error: 'Sunucu hatası / Server error' });
  }
};

// /api/reading.js
// Proxies AI reading requests and marks code as used upon completion
const { kv } = require('@vercel/kv');

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

    // Call Claude API
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
      return res.status(502).json({ error: 'AI service error', details: errorData });
    }

    const aiData = await anthropicResponse.json();

    // Mark code as 'used' after successful reading
    if (session_token) {
      try {
        const sessionData = await kv.get(`session:${session_token}`);
        if (sessionData && sessionData.code) {
          const codeData = await kv.get(`code:${sessionData.code}`);
          if (codeData) {
            // Mark code as permanently used
            await kv.set(`code:${sessionData.code}`, {
              ...codeData,
              status: 'used',
              used_at: new Date().toISOString()
            });
          }
          // Update session readings_done count
          await kv.set(`session:${session_token}`, {
            ...sessionData,
            readings_done: (sessionData.readings_done || 0) + 1
          }, { ex: 7200 });
        }
      } catch (kvError) {
        // Don't fail the reading if KV update fails — log and continue
        console.error('KV update error (non-fatal):', kvError);
      }
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

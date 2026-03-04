module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { system_prompt, user_prompt, max_tokens } = req.body;

    if (!system_prompt || !user_prompt) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

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

// /api/validate-code.js
// Validates an access code and returns a session token + allowed spread type

const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Geçersiz kod / Invalid code' });
    }

    // Normalize code: uppercase, trim
    const normalizedCode = code.trim().toUpperCase();
    
    // Look up code in database
    const codeData = await kv.get(`code:${normalizedCode}`);
    
    if (!codeData) {
      return res.status(404).json({ error: 'Kod bulunamadı / Code not found' });
    }

    // Check if already used
    if (codeData.status === 'used') {
      return res.status(410).json({ error: 'Bu kod zaten kullanılmış / This code has already been used' });
    }

    // Check expiration (30 days from creation)
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Bu kodun süresi dolmuş / This code has expired' });
    }

    // Generate session token (valid for 2 hours)
    const sessionToken = uuidv4();
    const sessionData = {
      code: normalizedCode,
      spread_type: codeData.spread_type,
      spread_name: codeData.spread_name,
      created_at: new Date().toISOString(),
      readings_done: 0 // Track if reading was completed
    };

    // Store session (expires in 2 hours = 7200 seconds)
    await kv.set(`session:${sessionToken}`, sessionData, { ex: 7200 });

    // Mark code as "in_use" (prevent double usage)
    await kv.set(`code:${normalizedCode}`, {
      ...codeData,
      status: 'in_use',
      session_started: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      session_token: sessionToken,
      spread_type: codeData.spread_type,
      spread_name: codeData.spread_name,
      message: 'Kod doğrulandı! / Code validated!'
    });

  } catch (error) {
    console.error('Validate code error:', error);
    return res.status(500).json({ error: 'Sunucu hatası / Server error' });
  }
};

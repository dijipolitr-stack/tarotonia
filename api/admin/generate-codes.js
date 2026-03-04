// /api/admin/generate-codes.js
// Admin endpoint to generate access codes
// Protected by ADMIN_SECRET environment variable

const { kv } = require('@vercel/kv');

// Spread type definitions matching frontend
const SPREAD_TYPES = {
  yesno:       { nameEn: 'Yes/No Reading',      nameTr: 'Evet/Hayır',      cards: 1  },
  daily:       { nameEn: 'Daily Card',           nameTr: 'Günlük Kart',     cards: 1  },
  single:      { nameEn: 'Single Question',      nameTr: 'Tek Soru',        cards: 1  },
  three:       { nameEn: 'Three Card Spread',    nameTr: 'Üç Kart',         cards: 3  },
  mood:        { nameEn: 'Mind Body Spirit',      nameTr: 'Ruh Hali',        cards: 3  },
  love:        { nameEn: 'Love Spread',          nameTr: 'Aşk Açılımı',     cards: 5  },
  career:      { nameEn: 'Career Path',          nameTr: 'Kariyer Yolu',    cards: 5  },
  horseshoe:   { nameEn: 'Horseshoe Spread',     nameTr: 'At Nalı',         cards: 7  },
  celtic:      { nameEn: 'Celtic Cross',         nameTr: 'Kelt Haçı',       cards: 10 }
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
  let code = 'TAROT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const { spread_type, count = 1, etsy_order_id = '' } = req.body;

    // Validate spread type
    if (!spread_type || !SPREAD_TYPES[spread_type]) {
      return res.status(400).json({ 
        error: 'Invalid spread_type',
        valid_types: Object.keys(SPREAD_TYPES)
      });
    }

    // Limit batch size
    const codeCount = Math.min(Math.max(1, parseInt(count)), 100);
    const spreadInfo = SPREAD_TYPES[spread_type];
    
    const codes = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    for (let i = 0; i < codeCount; i++) {
      // Generate unique code (retry if exists)
      let code;
      let attempts = 0;
      do {
        code = generateCode();
        const existing = await kv.get(`code:${code}`);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      const codeData = {
        code,
        spread_type,
        spread_name: spreadInfo.nameEn,
        spread_name_tr: spreadInfo.nameTr,
        cards: spreadInfo.cards,
        status: 'unused',
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        etsy_order_id
      };

      // Store in KV (with 31-day TTL to auto-cleanup)
      await kv.set(`code:${code}`, codeData, { ex: 31 * 24 * 60 * 60 });
      codes.push({ code, spread_type, spread_name: spreadInfo.nameEn, expires_at: expiresAt.toISOString() });
    }

    return res.status(200).json({
      success: true,
      count: codes.length,
      codes,
      message: `${codes.length} kod oluşturuldu / ${codes.length} codes generated`
    });

  } catch (error) {
    console.error('Generate codes error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

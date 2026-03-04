#!/usr/bin/env node
// ============================================================
// MYSTIC TAROT - Kod Üretici / Code Generator
// ============================================================
// Kullanım / Usage:
//   node scripts/generate-codes.js <spread_type> [count]
//
// Örnekler / Examples:
//   node scripts/generate-codes.js celtic 10      → 10 adet Kelt Haçı kodu
//   node scripts/generate-codes.js daily 20       → 20 adet Günlük Kart kodu
//   node scripts/generate-codes.js love 5         → 5 adet Aşk Açılımı kodu
//   node scripts/generate-codes.js all 5          → Her tipten 5'er adet (45 toplam)
//
// Not: Bu script ADMIN_SECRET ve KV_REST_API_URL/KV_REST_API_TOKEN
//      environment variable'larını gerektirir.
//      .env dosyasından veya Vercel CLI'dan otomatik yüklenir.
// ============================================================

const SPREAD_TYPES = {
  yesno:     { name: 'Evet/Hayır (Yes/No)',          cards: 1  },
  daily:     { name: 'Günlük Kart (Daily Card)',      cards: 1  },
  single:    { name: 'Tek Soru (Single Question)',    cards: 1  },
  three:     { name: 'Üç Kart (Three Card)',          cards: 3  },
  mood:      { name: 'Ruh Hali (Mind Body Spirit)',   cards: 3  },
  love:      { name: 'Aşk Açılımı (Love Spread)',    cards: 5  },
  career:    { name: 'Kariyer Yolu (Career Path)',    cards: 5  },
  horseshoe: { name: 'At Nalı (Horseshoe)',           cards: 7  },
  celtic:    { name: 'Kelt Haçı (Celtic Cross)',      cards: 10 }
};

const API_BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function generateCodes(spreadType, count) {
  if (!ADMIN_SECRET) {
    console.error('❌ ADMIN_SECRET environment variable gerekli!');
    console.error('   export ADMIN_SECRET=your-secret-here');
    process.exit(1);
  }

  console.log(`\n🔮 Tarotania - Kod Üretici`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const types = spreadType === 'all' ? Object.keys(SPREAD_TYPES) : [spreadType];
  
  for (const type of types) {
    if (!SPREAD_TYPES[type]) {
      console.error(`❌ Geçersiz açılım tipi: ${type}`);
      console.error(`   Geçerli tipler: ${Object.keys(SPREAD_TYPES).join(', ')}, all`);
      process.exit(1);
    }

    console.log(`\n📦 ${SPREAD_TYPES[type].name} - ${count} adet üretiliyor...`);

    try {
      const res = await fetch(`${API_BASE}/api/admin/generate-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ADMIN_SECRET}`
        },
        body: JSON.stringify({ spread_type: type, count })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(`   ❌ Hata: ${err.error || res.statusText}`);
        continue;
      }

      const data = await res.json();
      
      console.log(`   ✅ ${data.count} kod oluşturuldu:\n`);
      
      // Print codes in a nice format
      data.codes.forEach((c, i) => {
        console.log(`   ${String(i + 1).padStart(3)}.  ${c.code}  │  ${c.spread_name}  │  Son: ${c.expires_at.split('T')[0]}`);
      });

      // Also output as CSV-compatible format
      console.log(`\n   📋 Etsy PDF için kopyala:`);
      data.codes.forEach(c => {
        console.log(`   ${c.code}`);
      });

    } catch (error) {
      console.error(`   ❌ Bağlantı hatası: ${error.message}`);
      console.error(`   API_BASE: ${API_BASE}`);
    }
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✨ Tamamlandı!\n`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log(`
🔮 Tarotania - Kod Üretici

Kullanım: node scripts/generate-codes.js <spread_type> [count]

Açılım Tipleri:
${Object.entries(SPREAD_TYPES).map(([k, v]) => `  ${k.padEnd(12)} ${v.name} (${v.cards} kart)`).join('\n')}
  ${'all'.padEnd(12)} Tüm tiplerden üret

Örnekler:
  node scripts/generate-codes.js celtic 10
  node scripts/generate-codes.js all 5
`);
  process.exit(0);
}

const spreadType = args[0].toLowerCase();
const count = parseInt(args[1]) || 1;

generateCodes(spreadType, count);

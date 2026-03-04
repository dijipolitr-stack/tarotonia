#!/usr/bin/env node
// ============================================================
// MYSTIC TAROT - Etsy Teslimat PDF Üretici
// ============================================================
// Bu script, müşteriye teslim edilecek PDF dosyalarını üretir.
// Her PDF bir erişim kodu ve kullanım talimatı içerir.
//
// Kullanım:
//   node scripts/create-etsy-pdf.js <code> <spread_type> <lang>
//
// Örnek:
//   node scripts/create-etsy-pdf.js TAROT-7X9K2M celtic tr
//   node scripts/create-etsy-pdf.js TAROT-ABC123 love en
//
// Not: Bu basit bir HTML→PDF template'i üretir.
//      Canva veya benzeri araçlarla da güzel PDF'ler tasarlayabilirsiniz.
// ============================================================

const fs = require('fs');

const SPREAD_INFO = {
  yesno:     { en: 'Yes/No Reading',     tr: 'Evet/Hayır Falı',       cards: 1  },
  daily:     { en: 'Daily Card',          tr: 'Günlük Kart',           cards: 1  },
  single:    { en: 'Single Question',     tr: 'Tek Soru Okuması',      cards: 1  },
  three:     { en: 'Three Card Spread',   tr: 'Üç Kart Açılımı',      cards: 3  },
  mood:      { en: 'Mind Body Spirit',    tr: 'Ruh Hali Okuması',     cards: 3  },
  love:      { en: 'Love Spread',         tr: 'Aşk Açılımı',          cards: 5  },
  career:    { en: 'Career Path',         tr: 'Kariyer Yolu Açılımı', cards: 5  },
  horseshoe: { en: 'Horseshoe Spread',    tr: 'At Nalı Açılımı',      cards: 7  },
  celtic:    { en: 'Celtic Cross',        tr: 'Kelt Haçı Açılımı',    cards: 10 }
};

const SITE_URL = process.env.SITE_URL || 'https://your-site.vercel.app';

function generatePDFHTML(code, spreadType, lang = 'tr') {
  const spread = SPREAD_INFO[spreadType];
  if (!spread) throw new Error(`Invalid spread type: ${spreadType}`);
  
  const isTr = lang === 'tr';
  const spreadName = isTr ? spread.tr : spread.en;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Cormorant Garamond', serif;
    background: #0a0a0f;
    color: #e8e0d0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .card {
    width: 600px;
    background: linear-gradient(145deg, #12101a, #1a1528);
    border: 2px solid rgba(198, 169, 78, 0.3);
    border-radius: 20px;
    padding: 50px 40px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  
  .logo { font-size: 4rem; margin-bottom: 15px; }
  
  .title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.8rem;
    color: #c6a94e;
    margin-bottom: 5px;
  }
  
  .subtitle {
    font-size: 1rem;
    color: #8a7a6a;
    margin-bottom: 30px;
    font-style: italic;
  }
  
  .spread-badge {
    display: inline-block;
    padding: 8px 25px;
    background: linear-gradient(135deg, rgba(198,169,78,0.15), rgba(198,169,78,0.05));
    border: 1px solid rgba(198,169,78,0.3);
    border-radius: 20px;
    font-family: 'Cinzel Decorative', serif;
    font-size: 0.8rem;
    color: #c6a94e;
    letter-spacing: 2px;
    margin-bottom: 30px;
  }
  
  .code-label {
    font-size: 0.85rem;
    color: #8a7a6a;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  
  .code-box {
    font-family: 'Cinzel Decorative', serif;
    font-size: 2.2rem;
    letter-spacing: 5px;
    color: #f5e6c4;
    padding: 20px 30px;
    background: rgba(198,169,78,0.08);
    border: 2px dashed rgba(198,169,78,0.3);
    border-radius: 12px;
    margin-bottom: 30px;
  }
  
  .divider {
    width: 80px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #c6a94e, transparent);
    margin: 25px auto;
  }
  
  .steps { text-align: left; max-width: 400px; margin: 0 auto; }
  
  .step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 1rem;
    line-height: 1.5;
  }
  
  .step-num {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    background: rgba(198,169,78,0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: #c6a94e;
    font-weight: 700;
    margin-top: 3px;
  }
  
  .url {
    color: #c6a94e;
    font-weight: 600;
    text-decoration: none;
  }
  
  .footer {
    margin-top: 30px;
    font-size: 0.8rem;
    color: #5a5040;
    line-height: 1.6;
  }
  
  .warning {
    font-size: 0.75rem;
    color: #c44b4b;
    margin-top: 15px;
    padding: 8px 15px;
    border: 1px solid rgba(196,75,75,0.2);
    border-radius: 8px;
    background: rgba(196,75,75,0.05);
  }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🔮</div>
    <h1 class="title">Tarotania</h1>
    <p class="subtitle">${isTr ? 'Kişiselleştirilmiş AI Tarot Okuması' : 'Personalized AI Tarot Reading'}</p>
    
    <div class="spread-badge">✦ ${spreadName} (${spread.cards} ${isTr ? 'Kart' : 'Cards'}) ✦</div>
    
    <div class="code-label">${isTr ? 'ERİŞİM KODUNUZ' : 'YOUR ACCESS CODE'}</div>
    <div class="code-box">${code}</div>
    
    <div class="divider"></div>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div>${isTr ? 'Aşağıdaki siteyi ziyaret edin' : 'Visit the website below'}:<br><span class="url">${SITE_URL}</span></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div>${isTr ? 'Erişim kodunuzu giriş ekranına yazın' : 'Enter your access code on the login screen'}</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div>${isTr ? 'Sorunuzu yazın ve kartlarınızı sezgilerinizle seçin' : 'Type your question and choose cards with your intuition'}</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div>${isTr ? 'AI tarot ustanız derinlemesine kişisel yorumunuzu hazırlayacak' : 'Your AI tarot master will prepare a deep personal interpretation'}</div>
      </div>
    </div>
    
    <div class="warning">
      ⚠️ ${isTr 
        ? 'Bu kod TEK KULLANIMLIKTIR. Bir okuma yapıldıktan sonra tekrar kullanılamaz. Kodunuz 30 gün geçerlidir.' 
        : 'This code is SINGLE USE. It cannot be reused after one reading. Your code is valid for 30 days.'}
    </div>
    
    <div class="footer">
      ${isTr 
        ? '✨ Her okuma benzersizdir — yapay zeka, kartlarınızın enerjisini derinlemesine yorumlar.<br>Sorularınız için Etsy üzerinden bize mesaj atabilirsiniz.'
        : '✨ Every reading is unique — AI deeply interprets the energy of your cards.<br>Contact us via Etsy for any questions.'}
    </div>
  </div>
</body>
</html>`;
}

// CLI
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log(`
🔮 Etsy Teslimat PDF Üretici

Kullanım: node scripts/create-etsy-pdf.js <code> <spread_type> [lang]

Örnekler:
  node scripts/create-etsy-pdf.js TAROT-7X9K2M celtic tr
  node scripts/create-etsy-pdf.js TAROT-ABC123 love en

Spread types: ${Object.keys(SPREAD_INFO).join(', ')}
`);
  process.exit(0);
}

const code = args[0].toUpperCase();
const spreadType = args[1].toLowerCase();
const lang = args[2] || 'tr';

const html = generatePDFHTML(code, spreadType, lang);
const filename = `etsy-delivery-${code}.html`;
fs.writeFileSync(filename, html);
console.log(`✅ ${filename} oluşturuldu!`);
console.log(`   Tarayıcıda açıp Ctrl+P ile PDF olarak kaydedin.`);

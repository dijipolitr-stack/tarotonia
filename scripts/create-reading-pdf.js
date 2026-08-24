#!/usr/bin/env node
// ============================================================
// TAROTONIA - Okuma Teslimat Belgesi Üretici
// ============================================================
// Müşteriye gönderilecek okuma belgesini üretir.
//
// Tasarım ilkesi: bu bir rapor değil, mektup. Sabit bölüm
// başlığı, tablo, rozet, gradient yok. Kartlar metnin içine
// dönüşümlü olarak yerleşir, blok halinde listelenmez.
//
// Kullanım:
//   node scripts/create-reading-pdf.js <okuma.json> [cikti.html]
//
// Girdi JSON şeması:
//   {
//     "name": "Ayşe",                  // müşteri adı (hitap için)
//     "date": "2026-08-19",            // opsiyonel, yoksa bugün
//     "spread": "Üç Kart Açılımı",     // opsiyonel, sadece künyede
//     "lang": "tr",                    // tr|en|de|ar|ru... yön ve ay adı için
//     "cards": [                       // sırayla, metne serpiştirilir
//       { "id": "m0", "name": "Joker", "reversed": false }
//     ],
//     "body": "Paragraflar\n\niki satır boşlukla ayrılmış düz metin.",
//     "signature": "Tarotonia"         // opsiyonel
//   }
//
// Kart görselleri public/index.html içindeki CARD_IMAGES'tan okunur.
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---- Dil tablosu ----------------------------------------------
// Belgede AI metni dışında kalan tek tük ifadeler. Yeni bir pazara
// açılırken buraya bir satır eklemek yeterli.
const L10N = {
  tr: { greet: 'Sevgili',   hello: 'Merhaba,', close: 'Sevgiyle,',    rev: 'ters',        note: 'Bu okuma yalnızca senin için hazırlandı.' },
  en: { greet: 'Dear',      hello: 'Hello,',   close: 'With love,',   rev: 'reversed',    note: 'This reading was prepared for you alone.' },
  de: { greet: 'Liebe(r)',  hello: 'Hallo,',   close: 'Herzlichst,',  rev: 'umgekehrt',   note: 'Diese Legung wurde allein für dich erstellt.' },
  es: { greet: 'Querida/o', hello: 'Hola,',    close: 'Con cariño,',  rev: 'invertida',   note: 'Esta lectura fue preparada solo para ti.' },
  fr: { greet: 'Chère/Cher',hello: 'Bonjour,', close: 'Avec amour,',  rev: 'inversée',    note: 'Cette lecture a été préparée rien que pour toi.' },
  ru: { greet: 'Дорогая/ой',hello: 'Здравствуйте,', close: 'С любовью,', rev: 'перевёрнутая', note: 'Этот расклад создан только для тебя.' },
  ar: { greet: 'عزيزتي/عزيزي', hello: 'مرحباً،', close: 'مع المحبة،', rev: 'معكوسة',      note: 'أُعدّت هذه القراءة من أجلك وحدك.' }
};

// Sağdan sola yazılan diller: sayfa yönü ve kart yerleşimi ters çevrilir.
const RTL = ['ar', 'he', 'fa', 'ur'];

// ---- Kart görsellerini ana uygulamadan çek --------------------
// Tek kaynak public/index.html. Görselleri ayrıca kopyalamıyoruz ki
// deste güncellenince belge de kendiliğinden güncel kalsın.
function loadCardImages() {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const start = html.indexOf('const CARD_IMAGES = {');
  if (start === -1) throw new Error('CARD_IMAGES bulunamadı');

  const images = {};
  const re = /['"]([a-z0-9]+)['"]\s*:\s*['"](data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+)['"]/g;
  const segment = html.slice(start);
  let m;
  while ((m = re.exec(segment)) !== null) {
    images[m[1]] = m[2];
    if (Object.keys(images).length >= 78) break;
  }
  return images;
}

function formatDate(iso, lang) {
  const d = iso ? new Date(iso) : new Date();
  // Gün + ay adı, yıl yok. "19 Ağustos" / "19 August" / "١٩ أغسطس"
  // Rakamsal tarihten daha kişisel duruyor. Intl her dili kendi
  // yazım kuralıyla verir, elle çeviri tablosu tutmaya gerek yok.
  try {
    return new Intl.DateTimeFormat(lang || 'tr', { day: 'numeric', month: 'long' }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Kartları metne serpiştir ---------------------------------
// Kartlar bir blok halinde listelenmez. Paragraflar arasına eşit
// aralıklarla, dönüşümlü sağ/sol yerleşir. Böylece sayfa her
// okumada farklı görünür ve şablon hissi kırılır.
function buildLetterBody(paragraphs, cards, images, t, isRtl) {
  const out = [];
  const n = paragraphs.length;
  const c = cards.length;

  // İlk paragraf kartsız kalsın, mektup sözle açılsın.
  const step = c > 0 ? Math.max(1, Math.floor((n - 1) / c)) : 0;
  const slots = new Map();
  for (let i = 0; i < c; i++) {
    const at = Math.min(n - 1, 1 + i * step);
    slots.set(at, i);
  }

  paragraphs.forEach(function (p, i) {
    if (slots.has(i)) {
      const idx = slots.get(i);
      const card = cards[idx];
      // RTL dillerde ilk kart sola gelsin: metin sağdan aktığı için
      // göz önce sol kenardaki boşluğu arıyor.
      const evenSide = isRtl ? 'left' : 'right';
      const oddSide  = isRtl ? 'right' : 'left';
      const side = idx % 2 === 0 ? evenSide : oddSide;
      const img = images[card.id];
      const rotate = card.reversed ? 'transform:rotate(180deg);' : '';
      const caption = card.reversed
        ? escapeHtml(card.name) + ' <span class="rev">(' + t.rev + ')</span>'
        : escapeHtml(card.name);

      const visual = img
        ? '<img src="' + img + '" style="' + rotate + '" alt="' + escapeHtml(card.name) + '">'
        : '<div class="card-fallback">' + escapeHtml(card.name) + '</div>';

      out.push(
        '<figure class="card ' + side + '">\n  ' + visual +
        '\n  <figcaption>' + caption + '</figcaption>\n</figure>'
      );
    }
    out.push('<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>');
  });

  return out.join('\n');
}

function generateHTML(data, images) {
  const lang = (data.lang || 'tr').toLowerCase();
  const t = L10N[lang] || L10N.en;
  const isRtl = RTL.indexOf(lang) !== -1;

  const name = (data.name || '').trim();
  // Arapçada virgül ters yönlü (، ) — hitabı dil tablosundan kuruyoruz.
  const comma = isRtl ? '،' : ',';
  const greeting = name ? t.greet + ' ' + escapeHtml(name) + comma : t.hello;
  const paragraphs = String(data.body || '')
    .split(/\n\s*\n/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  const cards = Array.isArray(data.cards) ? data.cards : [];
  const signature = data.signature || 'Tarotonia';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name || 'Tarotonia')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Gövde: EB Garamond (Latin + Latin Ext + Kiril + Yunan) ve Amiri (Arapça).
     İmza: Caveat (Latin + Latin Ext + Kiril) ve Aref Ruqaa (Arapça hat).
     Tarayıcı bir glifi bulamazsa sıradaki fonta düşer, bu yüzden tek bir
     font-family satırı bütün dilleri karşılıyor. -->
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Amiri:ital,wght@0,400;1,400&family=Caveat:wght@400;600&family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 20mm 18mm; }

  :root {
    --paper: #faf6ee;
    --ink:   #2e2a24;
    --soft:  #6b6155;
    --rule:  #d8cdb8;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: 'EB Garamond', 'Amiri', Garamond, 'Times New Roman', serif;
    font-size: 12.5pt;
    line-height: 1.75;
  }

  /* Arap alfabesi aynı punto değerinde daha küçük ve sıkışık görünür,
     satır arası da dar kalır. Bu iki satır olmadan metin okunmuyor. */
  html[lang="ar"] body { font-size: 14pt; line-height: 2.05; }

  .sheet {
    max-width: 168mm;
    margin: 0 auto;
    padding: 14mm 0 8mm;
  }

  /* Künye sağ üstte, küçük. Elle yazılmış bir başlık gibi durur. */
  .meta {
    text-align: end;
    font-size: 10pt;
    color: var(--soft);
    font-style: italic;
    margin-bottom: 16mm;
    letter-spacing: .2px;
  }
  .meta .spread {
    display: block;
    font-style: normal;
    letter-spacing: 1.2px;
    font-size: 8.5pt;
    text-transform: uppercase;
    color: #a3937c;
    margin-top: 2px;
  }

  .greeting {
    font-size: 14pt;
    margin: 0 0 7mm;
  }

  p {
    margin: 0 0 5.5mm;
    text-align: justify;
    hyphens: auto;
  }
  /* İlk paragrafta girinti yok, sonrakilerde var. Kitap dizgisi
     alışkanlığı: metni "çıktı" değil "yazı" gibi gösteriyor. */
  p + p { text-indent: 6mm; }

  figure.card {
    margin: 0 0 4mm;
    width: 34mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  figure.card.right { float: right; margin-left: 7mm; transform: rotate(1deg); }
  figure.card.left  { float: left;  margin-right: 7mm; transform: rotate(-1deg); }

  figure.card img {
    width: 100%;
    display: block;
    border-radius: 1.5mm;
    /* Hafif gölge ve tek derecelik eğim: masaya konmuş gerçek kart hissi */
    box-shadow: 0 1mm 3mm rgba(60, 45, 20, .18);
  }

  .card-fallback {
    aspect-ratio: 2/3;
    border: 1px solid var(--rule);
    display: flex; align-items: center; justify-content: center;
    padding: 3mm; text-align: center; font-size: 9pt; color: var(--soft);
  }

  figcaption {
    margin-top: 2mm;
    font-size: 8.5pt;
    font-style: italic;
    color: var(--soft);
    text-align: center;
    line-height: 1.35;
  }
  figcaption .rev { color: #9a8a72; }

  .closing {
    clear: both;
    margin-top: 10mm;
  }
  .closing .line { margin: 0 0 1mm; text-indent: 0; }

  /* İmza fontu Caveat: süslü el yazılarının aksine Latin Extended ve
     Kiril bloklarını tam kapsıyor, yani ğ ş ı İ ö ü ç, ä ß, é à, ñ, щ
     hepsi doğru çiziliyor. Arapça glifler Aref Ruqaa'ya düşer. */
  .signature {
    font-family: 'Caveat', 'Aref Ruqaa', 'Segoe Script', cursive;
    font-size: 21pt;
    color: #4a4034;
    margin-top: 3mm;
    line-height: 1.25;
  }
  html[lang="ar"] .signature { font-size: 17pt; line-height: 1.6; }

  .footer {
    clear: both;
    margin-top: 16mm;
    padding-top: 4mm;
    border-top: 1px solid var(--rule);
    font-size: 8.5pt;
    color: #9d917f;
    text-align: center;
    font-style: italic;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { padding-top: 0; }
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="meta">
    ${formatDate(data.date, lang)}
    ${data.spread ? '<span class="spread">' + escapeHtml(data.spread) + '</span>' : ''}
  </div>

  <p class="greeting">${greeting}</p>

${buildLetterBody(paragraphs, cards, images, t, isRtl)}

  <div class="closing">
    <p class="line">${t.close}</p>
    <div class="signature">${escapeHtml(signature)}</div>
  </div>

  <div class="footer">
    ${t.note}
  </div>

</div>
</body>
</html>`;
}

// ---- CLI ------------------------------------------------------
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log([
    '',
    'Tarotonia okuma belgesi üretici',
    '',
    'Kullanım: node scripts/create-reading-pdf.js <okuma.json> [cikti.html]',
    '',
    'Örnek:  node scripts/create-reading-pdf.js scripts/ornek-okuma.json',
    ''
  ].join('\n'));
  process.exit(0);
}

const inputPath = args[0];
const outPath = args[1] || inputPath.replace(/\.json$/i, '') + '.html';

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const images = loadCardImages();
fs.writeFileSync(outPath, generateHTML(data, images), 'utf8');

console.log('Hazır: ' + outPath);
console.log('Tarayıcıda aç, Ctrl+P, "Arka plan grafikleri" işaretli, PDF olarak kaydet.');

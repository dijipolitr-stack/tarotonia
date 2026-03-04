# 🔮 Tarotania - Kurulum ve Deploy Rehberi

## Proje Yapısı

```
tarotania/
├── api/
│   ├── validate-code.js      # Erişim kodu doğrulama
│   ├── reading.js             # AI yorum proxy (API key güvenliği)
│   └── admin/
│       ├── generate-codes.js  # Kod üretme (admin)
│       └── stats.js           # İstatistikler (admin)
├── public/
│   └── index.html             # Ana uygulama (frontend)
├── scripts/
│   ├── generate-codes.js      # CLI kod üretici
│   └── create-etsy-pdf.js     # Etsy teslimat PDF üretici
├── vercel.json                # Vercel konfigürasyonu
├── package.json
├── .env.example
├── .gitignore
└── README.md                  # Bu dosya
```

---

## 🚀 Adım Adım Kurulum

### 1. GitHub Repository Oluştur

```bash
# Proje klasörüne git
cd tarotania

# Git başlat
git init
git add .
git commit -m "Initial commit - Tarotania"

# GitHub'da yeni repo oluştur (github.com/new)
# Sonra bağla:
git remote add origin https://github.com/KULLANICI_ADIN/tarotania.git
git branch -M main
git push -u origin main
```

### 2. Vercel Hesabı Aç ve Projeyi Bağla

1. **https://vercel.com** adresine git
2. **"Sign Up with GitHub"** tıkla → GitHub hesabınla giriş yap
3. **"Import Project"** → GitHub'dan `tarotania` reposunu seç
4. **Framework Preset**: "Other" seç
5. **Deploy** tıkla → İlk deploy başlayacak (henüz çalışmaz, sorun değil)

### 3. Vercel KV Veritabanı Oluştur

1. Vercel Dashboard'da projenin sayfasına git
2. **"Storage"** sekmesine tıkla
3. **"Create Database"** → **"KV"** seç
4. İsim ver: `tarotania-db`
5. **"Create"** tıkla
6. Otomatik olarak KV_REST_API_URL ve KV_REST_API_TOKEN eklenir

### 4. Environment Variables Ekle

Vercel Dashboard → Projen → **"Settings"** → **"Environment Variables"**

Şu değişkenleri ekle:

| Key | Value | Açıklama |
|-----|-------|----------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | console.anthropic.com'dan |
| `ADMIN_SECRET` | (güçlü bir şifre) | Kod üretmek için. Minimum 32 karakter önerilir |

⚠️ **KV_REST_API_URL** ve **KV_REST_API_TOKEN** otomatik eklenir, elle ekleme.

### 5. Yeniden Deploy Et

Environment variable'lar eklendikten sonra:

1. **"Deployments"** sekmesine git
2. En son deployment'ın yanındaki **"..."** → **"Redeploy"**
3. Veya terminalde: `git commit --allow-empty -m "trigger deploy" && git push`

### 6. Test Et

Deploy tamamlandıktan sonra Vercel sana bir URL verir (ör: `tarotania-xyz.vercel.app`).

**Test kodu üret:**
```bash
# curl ile admin API'yi çağır
curl -X POST https://tarotania-xyz.vercel.app/api/admin/generate-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SENIN_ADMIN_SECRET" \
  -d '{"spread_type": "three", "count": 2}'
```

Yanıt:
```json
{
  "success": true,
  "count": 2,
  "codes": [
    {"code": "TAROT-7X9K2M", "spread_type": "three", ...},
    {"code": "TAROT-AB3HJK", "spread_type": "three", ...}
  ]
}
```

**Kodu test et:**
1. Site URL'ni aç
2. Üretilen kodu giriş ekranına yaz
3. Okumayı tamamla
4. Aynı kodu tekrar denediğinde "kullanılmış" hatası almalısın ✓

---

## 📦 Günlük Kullanım

### Kod Üretme (Admin API)

```bash
# Tek kod üret
curl -X POST https://SITE_URL/api/admin/generate-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_SECRET" \
  -d '{"spread_type": "celtic", "count": 1}'

# 20 adet Aşk Açılımı kodu üret
curl -X POST https://SITE_URL/api/admin/generate-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_SECRET" \
  -d '{"spread_type": "love", "count": 20}'
```

### Geçerli Açılım Tipleri

| spread_type | Açılım | Kart |
|-------------|--------|------|
| `yesno` | Evet/Hayır | 1 |
| `daily` | Günlük Kart | 1 |
| `single` | Tek Soru | 1 |
| `three` | Üç Kart | 3 |
| `mood` | Ruh Hali | 3 |
| `love` | Aşk Açılımı | 5 |
| `career` | Kariyer Yolu | 5 |
| `horseshoe` | At Nalı | 7 |
| `celtic` | Kelt Haçı | 10 |

### İstatistikleri Görüntüle

```bash
curl https://SITE_URL/api/admin/stats \
  -H "Authorization: Bearer ADMIN_SECRET"
```

### Etsy PDF Oluşturma

```bash
# Kodun HTML teslimat şablonunu oluştur
node scripts/create-etsy-pdf.js TAROT-7X9K2M celtic tr

# Tarayıcıda aç → Ctrl+P → PDF olarak kaydet → Etsy'ye yükle
```

---

## 🛒 Etsy Mağaza Kurulumu

### Etsy'de Her Açılım İçin Ürün Oluştur

1. **etsy.com/sell** → Mağaza aç
2. Her açılım tipi için ayrı bir listing oluştur
3. **Ürün tipi**: Digital Download
4. **Teslimat dosyası**: Ön-üretilmiş kodları içeren PDF
5. Stok bitince yeni kodlar üret, PDF güncelle

### Etsy Fiyat Önerileri

| Açılım | Önerilen Fiyat |
|--------|---------------|
| Günlük Kart / Evet-Hayır / Tek Soru | $2.99 - $3.99 |
| Üç Kart / Ruh Hali | $4.99 |
| Aşk / Kariyer | $6.99 |
| At Nalı | $8.99 |
| Kelt Haçı | $10.99 |

### İş Akışı

1. Her açılım tipi için 20-50 kod üret (admin API ile)
2. Her kodu ayrı bir PDF'e koy (create-etsy-pdf.js ile)
3. PDF'leri Etsy ürünlerine yükle
4. Stok bitince tekrarla

---

## 🔒 Güvenlik Notları

- **API Key**: Asla frontend'de görünmez, sadece backend'de
- **Admin Secret**: Sadece sen bilirsin, güçlü olsun
- **Kodlar**: Tek kullanımlık, 30 gün geçerli, otomatik temizlenir
- **Rate Limiting**: Vercel'in built-in rate limiting'i aktif

---

## 🌐 Custom Domain (İsteğe Bağlı)

1. Namecheap/Cloudflare'den domain satın al (ör: tarotania.com)
2. Vercel Dashboard → Settings → Domains → domain'i ekle
3. DNS ayarlarını Vercel'in gösterdiği şekilde yap
4. HTTPS otomatik aktif olur

---

## 🐛 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| "Server error" | Vercel Dashboard → Logs → hata detaylarına bak |
| KV bağlantı hatası | Storage sekmesinde KV'nin bağlı olduğunu kontrol et |
| API key hatası | Environment Variables'da ANTHROPIC_API_KEY doğru mu? |
| Kod doğrulanmıyor | Admin API ile stats'ı kontrol et, kod var mı? |
| Deploy çalışmıyor | `vercel.json` formatını kontrol et |

---

## 📊 Maliyet Özeti

| Kalem | Aylık Maliyet |
|-------|--------------|
| Vercel Hosting | $0 (ücretsiz tier) |
| Vercel KV | $0 (30K istek/ay ücretsiz) |
| Domain | ~$1/ay (yıllık $12) |
| Anthropic API | ~$0.02-0.08/okuma (kullanıma bağlı) |
| Etsy Komisyon | %6.5/satış + $0.20/listeleme |

**Toplam başlangıç maliyeti: ~$12 (domain)**
**Aylık sabit maliyet: ~$1**

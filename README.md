<div align="center">

# 📈 BIST Trade - Borsa İstanbul Simülatörü

**Gerçek zamanlı BIST hisse verisiyle sanal borsa deneyimi**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

🌐 **[bisttrade.com.tr](https://bisttrade.com.tr)**

</div>

---

## 🎯 Proje Hakkında

BIST Trade, Borsa İstanbul'daki **635+ hisse senedini** gerçek zamanlı takip edebileceğiniz ve sanal para ile alım-satım yapabileceğiniz bir borsa simülatörüdür. Hem yeni başlayanlar hem de deneyimli yatırımcılar için tasarlanmıştır.

### ✨ Öne Çıkan Özellikler

- 🔴 **Gerçek Zamanlı Veriler** — Yahoo Finance & Bigpara entegrasyonu ile canlı hisse fiyatları
- 💰 **Sanal Portföy** — 100.000₺ sanal bakiye ile risk almadan pratik yapın
- 📊 **Teknik Analiz** — RSI, MACD, Bollinger Bantları, hareketli ortalamalar
- 🤖 **Otomatik Alım-Satım** — Strateji oluşturun, sistem sizin yerinize işlem yapsın
- 🐋 **Balina Radarı** — Büyük hacimli işlemleri anlık takip edin
- 🔔 **Fiyat Alarmları** — Sesli ve görsel bildirimlerle hedef fiyat uyarıları
- 📱 **Mobil Uyumlu** — PWA desteği ile telefondan tam deneyim
- 🌙 **Karanlık Tema** — Göz yormayan koyu arayüz tasarımı
- 👤 **Misafir Modu** — Kayıt olmadan hemen deneyin

---

## 🏗️ Teknik Mimari

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  Next.js 14 (App Router) + TypeScript        │
│  Tailwind CSS + Radix UI + Recharts          │
│  Framer Motion + NextAuth.js                 │
├─────────────────────────────────────────────┤
│                  Backend                     │
│  Next.js API Routes (27 endpoint)            │
│  Prisma ORM + PostgreSQL                     │
│  Yahoo Finance + Bigpara API                 │
├─────────────────────────────────────────────┤
│               Altyapı                        │
│  VPS (Ubuntu) + Nginx + PM2 + SSL            │
│  GitHub CI/CD + PWA                          │
└─────────────────────────────────────────────┘
```

---

## 📂 Proje Yapısı

```
bisttrade/
├── app/
│   ├── api/                    # API Routes (27 endpoint)
│   │   ├── auth/               # NextAuth.js kimlik doğrulama
│   │   ├── stocks/             # Hisse verileri ve geçmiş
│   │   ├── trade/              # Alım-satım işlemleri
│   │   ├── portfolio/          # Portföy ve analiz
│   │   ├── alerts/             # Fiyat alarmları
│   │   ├── auto-trade/         # Otomatik alım-satım
│   │   ├── whale-radar/        # Balina radarı
│   │   ├── scanner/            # Fırsat tarayıcı
│   │   ├── news/               # Haber akışı
│   │   ├── forex/              # Döviz kurları
│   │   └── ...
│   ├── dashboard/              # Dashboard sayfaları
│   │   ├── market/             # Piyasa listesi
│   │   ├── trade/              # Alım-satım
│   │   ├── portfolio/          # Portföy
│   │   ├── analysis/           # Teknik analiz
│   │   ├── alerts/             # Alarmlar
│   │   ├── auto-trade/         # Otomatik strateji
│   │   ├── watchlist/          # Takip listesi
│   │   ├── orders/             # Emirler
│   │   └── history/            # İşlem geçmişi
│   ├── login/                  # Giriş sayfası
│   ├── signup/                 # Kayıt sayfası
│   └── page.tsx                # Landing page
├── components/
│   ├── dashboard/              # Dashboard bileşenleri
│   ├── trade/                  # Alım-satım bileşenleri
│   ├── portfolio/              # Portföy bileşenleri
│   ├── market/                 # Piyasa bileşenleri
│   ├── alerts/                 # Alarm bileşenleri
│   ├── landing/                # Landing page bileşenleri
│   ├── auth/                   # Giriş/Kayıt formları
│   └── ui/                     # Radix UI bileşenleri
├── lib/
│   ├── prisma.ts               # Prisma client (singleton)
│   ├── auth-options.ts         # NextAuth.js yapılandırması
│   ├── stock-utils.ts          # Finans formatlama araçları
│   ├── yahoo-finance.ts        # Yahoo Finance API
│   ├── multi-source-finance.ts # Çoklu veri kaynağı
│   └── guest-session.ts        # Misafir oturum yönetimi
├── prisma/
│   └── schema.prisma           # Veritabanı şeması (13 tablo)
├── scripts/
│   └── seed.ts                 # 635 BIST hissesi seed verisi
├── public/
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # Uygulama ikonları
└── hooks/
    └── use-user-id.ts          # Kullanıcı kimlik hook'u
```

---

## 🗄️ Veritabanı Şeması

| Tablo | Açıklama |
|-------|----------|
| `User` | Kullanıcı bilgileri, bakiye, rol |
| `Stock` | 635 BIST hissesi (sembol, fiyat, hacim) |
| `PriceHistory` | ~2M satır fiyat geçmişi |
| `Holding` | Portföydeki hisseler |
| `Transaction` | Alım-satım işlem geçmişi |
| `Order` | Bekleyen emirler (limit, stop-loss) |
| `PriceAlert` | Fiyat alarm tanımları |
| `AutoStrategy` | Otomatik alım-satım stratejileri |
| `Watchlist` | Takip listesi |
| `PortfolioSnapshot` | Portföy anlık değer geçmişi |
| `Account` | NextAuth hesap bilgileri |
| `Session` | Oturum bilgileri |
| `VerificationToken` | Doğrulama tokenları |

---

## 🚀 Kurulum

### Gereksinimler

- **Node.js** 18+
- **PostgreSQL** 16+
- **Yarn** paket yöneticisi

### 1. Repoyu klonlayın

```bash
git clone https://github.com/gulecgokhan70/bisttrade.git
cd bisttrade
```

### 2. Bağımlılıkları yükleyin

```bash
yarn install
```

### 3. Ortam değişkenlerini ayarlayın

`.env` dosyası oluşturun:

```env
DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/bisttrade_db"
NEXTAUTH_SECRET="rastgele-gizli-anahtar"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Veritabanını hazırlayın

```bash
# Tabloları oluştur
npx prisma db push

# Prisma client oluştur
npx prisma generate

# 635 hisse verisini yükle
npx tsx scripts/seed.ts
```

### 5. Uygulamayı çalıştırın

```bash
# Geliştirme modu
yarn dev

# Production build
yarn build && yarn start
```

Uygulama **http://localhost:3000** adresinde çalışacaktır.

---

## 🌐 Production Dağıtım (VPS)

```bash
# Nginx reverse proxy + PM2 + SSL
pm2 start "npx next start -p 3000" --name bisttrade --cwd /var/www/bisttrade
```

Deploy script ile güncelleme:

```bash
bash /var/www/deploy.sh
# GitHub'dan çeker → build eder → PM2 restart
```

---

## 📱 Sayfalar ve Özellikler

| Sayfa | Yol | Açıklama |
|-------|-----|----------|
| 🏠 Landing | `/` | Tanıtım sayfası, misafir giriş |
| 🔐 Giriş | `/login` | E-posta/şifre ile giriş |
| 📝 Kayıt | `/signup` | Yeni hesap oluşturma |
| 📊 Dashboard | `/dashboard` | Piyasa duyarlılığı, fırsat tarayıcı |
| 📈 Piyasa | `/dashboard/market` | 635 hisse canlı liste |
| 💹 Alım-Satım | `/dashboard/trade` | Grafik, emir verme, teknik analiz |
| 💼 Portföy | `/dashboard/portfolio` | Varlıklar, P&L grafik, analiz |
| 🔍 Analiz | `/dashboard/analysis` | Detaylı teknik analiz |
| 🔔 Alarmlar | `/dashboard/alerts` | Fiyat hedef bildirimleri |
| 🤖 Oto-Trade | `/dashboard/auto-trade` | Strateji oluştur ve çalıştır |
| ⭐ Takip | `/dashboard/watchlist` | Favori hisseler |
| 📋 Emirler | `/dashboard/orders` | Bekleyen emirler |
| 📜 Geçmiş | `/dashboard/history` | Tüm işlem geçmişi |

---

## 🔌 API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/stocks` | GET | Tüm hisseler (canlı fiyat) |
| `/api/stocks/[symbol]/history` | GET | Hisse fiyat geçmişi |
| `/api/stocks/[symbol]/suitability` | GET | Yatırım uygunluk analizi |
| `/api/stocks/[symbol]/whale` | GET | Balina hareketleri |
| `/api/trade` | POST | Alım-satım emri |
| `/api/portfolio` | GET | Portföy bilgileri |
| `/api/portfolio/analysis` | GET | Portföy analizi |
| `/api/portfolio/history` | GET | Portföy değer geçmişi |
| `/api/alerts` | GET/POST/DELETE | Fiyat alarmları CRUD |
| `/api/auto-trade` | GET/POST | Otomatik strateji yönetimi |
| `/api/auto-trade/execute` | POST | Strateji çalıştırma |
| `/api/orders` | GET | Emir listesi |
| `/api/scanner` | GET | Fırsat tarayıcı |
| `/api/whale-radar` | GET | Balina radarı |
| `/api/news` | GET | Finans haberleri |
| `/api/forex` | GET | Döviz kurları |
| `/api/transactions` | GET | İşlem geçmişi |
| `/api/watchlist` | GET/POST/DELETE | Takip listesi |
| `/api/guest` | POST | Misafir hesap oluştur |

---

## 🛠️ Kullanılan Teknolojiler

### Frontend
- **Next.js 14** — App Router, Server Components
- **TypeScript** — Tip güvenliği
- **Tailwind CSS** — Utility-first CSS
- **Radix UI** — Erişilebilir UI bileşenleri
- **Recharts** — Grafik kütüphanesi
- **Framer Motion** — Animasyonlar
- **Lucide React** — İkon seti

### Backend
- **Next.js API Routes** — Sunucu tarafı API
- **Prisma ORM** — Veritabanı yönetimi
- **NextAuth.js** — Kimlik doğrulama
- **bcryptjs** — Şifre hashleme

### Veri Kaynakları
- **Yahoo Finance API** — Canlı hisse fiyatları
- **Bigpara API** — Yedek veri kaynağı
- **TCMB** — Döviz kurları

### Altyapı
- **PostgreSQL 16** — İlişkisel veritabanı
- **Nginx** — Reverse proxy
- **PM2** — Process manager
- **Let's Encrypt** — SSL sertifikası
- **PWA** — Progressive Web App

---

## 📊 Proje İstatistikleri

| Metrik | Değer |
|--------|-------|
| Toplam Hisse | 635 |
| Fiyat Geçmişi | ~2.000.000 kayıt |
| API Endpoint | 27 |
| Sayfa Sayısı | 14 |
| Veritabanı Tablosu | 13 |

---

## 📄 Lisans

Bu proje eğitim amaçlı geliştirilmiştir. Gerçek yatırım tavsiyesi içermez.

---

<div align="center">

**Geliştirici:** Gökhan Güleç

🌐 [bisttrade.com.tr](https://bisttrade.com.tr)

</div>

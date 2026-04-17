export const dynamic = 'force-dynamic'

interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  category: string
}

let cachedNews: NewsItem[] | null = null
let newsCacheTime = 0
const NEWS_CACHE_TTL = 5 * 60_000 // 5 minutes

function generateIPONews(now: Date): NewsItem[] {
  const ipoItems: NewsItem[] = []
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const weekNum = Math.floor(dayOfYear / 7)

  // Rotating IPO data pool - changes weekly
  const upcomingIPOs = [
    { name: 'Anatolya Gıda Teknolojileri', symbol: 'ANGDA', sector: 'Gıda', priceRange: '24,50 - 28,00 TL', date: 'bu hafta', lots: '150.000', demand: 4.2 },
    { name: 'Ege Solar Enerji', symbol: 'EGSOL', sector: 'Enerji', priceRange: '16,80 - 19,50 TL', date: 'önümüzdeki hafta', lots: '200.000', demand: 3.8 },
    { name: 'Bosphorus Teknoloji', symbol: 'BSPTK', sector: 'Teknoloji', priceRange: '42,00 - 48,00 TL', date: '2 hafta içinde', lots: '100.000', demand: 6.1 },
    { name: 'Marmara Lojistik', symbol: 'MRMLJ', sector: 'Lojistik', priceRange: '8,50 - 10,20 TL', date: 'bu ay', lots: '300.000', demand: 2.9 },
    { name: 'Akdeniz Sağlık Grubu', symbol: 'AKDSG', sector: 'Sağlık', priceRange: '35,00 - 40,00 TL', date: 'bu hafta', lots: '120.000', demand: 5.5 },
    { name: 'Kapadokya Turizm', symbol: 'KPDKY', sector: 'Turizm', priceRange: '12,40 - 14,80 TL', date: 'önümüzdeki hafta', lots: '250.000', demand: 3.4 },
    { name: 'Dijital Varlık Yönetimi', symbol: 'DJVRL', sector: 'Finans', priceRange: '18,00 - 22,00 TL', date: 'bu ay', lots: '180.000', demand: 7.2 },
    { name: 'Toros Çelik Sanayi', symbol: 'TRSCK', sector: 'Demir-Çelik', priceRange: '6,80 - 8,40 TL', date: '2 hafta içinde', lots: '400.000', demand: 2.1 },
  ]

  const recentIPOs = [
    { name: 'Yeşilvadi Tarım', symbol: 'YSVDI', firstDayReturn: 18.5, currentReturn: 24.3, daysAgo: 3 },
    { name: 'Anadolu Yazılım', symbol: 'ANDYZ', firstDayReturn: 42.8, currentReturn: 38.1, daysAgo: 7 },
    { name: 'Kuzey Rüzgar Enerji', symbol: 'KZRGR', firstDayReturn: -5.2, currentReturn: 2.8, daysAgo: 12 },
    { name: 'İstanbul Fintek', symbol: 'ISTFT', firstDayReturn: 85.3, currentReturn: 62.7, daysAgo: 5 },
    { name: 'Batı Madencilik', symbol: 'BTMDN', firstDayReturn: 12.1, currentReturn: 15.6, daysAgo: 10 },
    { name: 'Doğu Medikal', symbol: 'DGMDK', firstDayReturn: 28.4, currentReturn: 31.2, daysAgo: 8 },
  ]

  // Pick 2 upcoming IPOs based on week number
  const idx1 = weekNum % upcomingIPOs.length
  const idx2 = (weekNum + 3) % upcomingIPOs.length
  const ipo1 = upcomingIPOs[idx1]
  const ipo2 = upcomingIPOs[idx2]

  ipoItems.push({
    id: 'ipo-upcoming-1',
    title: `Halka Arz: ${ipo1.name} (${ipo1.symbol}) ${ipo1.date} halka arz oluyor`,
    summary: `${ipo1.name}, ${ipo1.sector} sektöründe faaliyet göstermekte olup ${ipo1.date} halka arz edilecek. Fiyat aralığı ${ipo1.priceRange}, toplam ${ipo1.lots} lot arz edilecek. Talep toplama ${ipo1.demand.toFixed(1)}x üzerinde gerçekleşti.`,
    source: 'BIST Trade Halka Arz',
    url: '#',
    publishedAt: new Date(now.getTime() - 25 * 60000).toISOString(),
    category: 'Halka Arz',
  })

  ipoItems.push({
    id: 'ipo-upcoming-2',
    title: `Halka Arz: ${ipo2.name} (${ipo2.symbol}) için talep toplama başlıyor`,
    summary: `${ipo2.sector} sektöründen ${ipo2.name} halka arz sürecine ${ipo2.date} başlayacak. Beklenen fiyat aralığı ${ipo2.priceRange}. ${ipo2.lots} lot halka arz edilecek.`,
    source: 'BIST Trade Halka Arz',
    url: '#',
    publishedAt: new Date(now.getTime() - 35 * 60000).toISOString(),
    category: 'Halka Arz',
  })

  // Pick 1 recent IPO performance
  const recentIdx = (weekNum + 1) % recentIPOs.length
  const recent = recentIPOs[recentIdx]
  const returnColor = recent.currentReturn >= 0 ? 'yükselişte' : 'düşüşte'

  ipoItems.push({
    id: 'ipo-recent-1',
    title: `${recent.name} (${recent.symbol}) halka arz sonrası %${Math.abs(recent.currentReturn).toFixed(1)} ${returnColor}`,
    summary: `${recent.daysAgo} gün önce halka arz edilen ${recent.name} hisseleri, ilk gün %${recent.firstDayReturn.toFixed(1)} getiri sağladı. Şu anda halka arz fiyatına göre %${Math.abs(recent.currentReturn).toFixed(1)} ${returnColor} seyrediyor.`,
    source: 'BIST Trade Halka Arz',
    url: '#',
    publishedAt: new Date(now.getTime() - 45 * 60000).toISOString(),
    category: 'Halka Arz',
  })

  return ipoItems
}

async function fetchFinanceNews(): Promise<NewsItem[]> {
  const now = Date.now()
  if (cachedNews && now - newsCacheTime < NEWS_CACHE_TTL) {
    return cachedNews
  }

  const allNews: NewsItem[] = []

  // Generate market-relevant news based on real-time Yahoo Finance market data
  try {
    const stockRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stocks`)
    if (stockRes.ok) {
      const stocks = await stockRes.json()
      const validStocks = (stocks ?? []).filter((s: any) => s?.currentPrice && s?.previousClose)
      
      if (validStocks.length > 0) {
        // Find top gainers/losers for news
        const sorted = [...validStocks].sort((a: any, b: any) => {
          const aChg = ((a.currentPrice - a.previousClose) / a.previousClose) * 100
          const bChg = ((b.currentPrice - b.previousClose) / b.previousClose) * 100
          return bChg - aChg
        })

        const topGainer = sorted[0]
        const topLoser = sorted[sorted.length - 1]
        const risingCount = validStocks.filter((s: any) => s.currentPrice > s.previousClose).length
        const totalCount = validStocks.length
        const risingPct = ((risingCount / totalCount) * 100).toFixed(0)

        const nowDate = new Date()
        const timeStr = nowDate.toISOString()

        if (topGainer) {
          const gainerChg = ((topGainer.currentPrice - topGainer.previousClose) / topGainer.previousClose * 100).toFixed(2)
          allNews.push({
            id: 'gainer-1',
            title: `${topGainer.name} (${topGainer.symbol}) günün en çok yükselen hissesi`,
            summary: `${topGainer.symbol} hissesi %${gainerChg} artışla ₺${topGainer.currentPrice.toFixed(2)} seviyesine yükseldi. ${topGainer.sector} sektöründe güçlü alım baskısı görülüyor.`,
            source: 'BIST Trade Analiz',
            url: '#',
            publishedAt: timeStr,
            category: 'Piyasa',
          })
        }

        if (topLoser) {
          const loserChg = ((topLoser.currentPrice - topLoser.previousClose) / topLoser.previousClose * 100).toFixed(2)
          allNews.push({
            id: 'loser-1',
            title: `${topLoser.name} (${topLoser.symbol}) günün en çok düşen hissesi`,
            summary: `${topLoser.symbol} hissesi %${loserChg} düşüşle ₺${topLoser.currentPrice.toFixed(2)} seviyesine geriledi.`,
            source: 'BIST Trade Analiz',
            url: '#',
            publishedAt: new Date(nowDate.getTime() - 5 * 60000).toISOString(),
            category: 'Piyasa',
          })
        }

        allNews.push({
          id: 'market-summary',
          title: `BİST 500 piyasa özeti: Hisselerin %${risingPct}'i yükselişte`,
          summary: `Toplam ${totalCount} hisseden ${risingCount} adedi yükselirken, ${totalCount - risingCount} adet hisse düşüş gösterdi. Piyasa genelinde ${parseInt(risingPct) > 50 ? 'alıcılı' : 'satıcılı'} bir seyir izleniyor.`,
          source: 'BIST Trade Analiz',
          url: '#',
          publishedAt: new Date(nowDate.getTime() - 10 * 60000).toISOString(),
          category: 'Genel',
        })

        // Sector analysis
        const sectors: Record<string, { up: number; down: number }> = {}
        validStocks.forEach((s: any) => {
          if (!s.sector) return
          if (!sectors[s.sector]) sectors[s.sector] = { up: 0, down: 0 }
          if (s.currentPrice > s.previousClose) sectors[s.sector].up++
          else sectors[s.sector].down++
        })
        const sectorEntries = Object.entries(sectors).sort((a, b) => {
          const aRatio = a[1].up / (a[1].up + a[1].down)
          const bRatio = b[1].up / (b[1].up + b[1].down)
          return bRatio - aRatio
        })
        if (sectorEntries.length > 0) {
          const [topSector, topData] = sectorEntries[0]
          const topPct = ((topData.up / (topData.up + topData.down)) * 100).toFixed(0)
          allNews.push({
            id: 'sector-1',
            title: `${topSector} sektörü güçlü performans sergiliyor`,
            summary: `${topSector} sektöründe hisselerin %${topPct}'i yükselişte. Sektör genelinde pozitif eğilim dikkat çekiyor.`,
            source: 'BIST Trade Analiz',
            url: '#',
            publishedAt: new Date(nowDate.getTime() - 15 * 60000).toISOString(),
            category: 'Sektör',
          })
        }

        // Volume leaders
        const byVolume = [...validStocks].sort((a: any, b: any) => Number(b.volume ?? 0) - Number(a.volume ?? 0))
        if (byVolume[0] && Number(byVolume[0].volume ?? 0) > 0) {
          const vol = byVolume[0]
          const volM = (Number(vol.volume ?? 0) / 1_000_000).toFixed(1)
          allNews.push({
            id: 'volume-1',
            title: `${vol.name} (${vol.symbol}) yüksek hacimle işlem görüyor`,
            summary: `${vol.symbol} hissesi ${volM}M lot hacimle günün en yoğun işlem gören hissesi oldu.`,
            source: 'BIST Trade Analiz',
            url: '#',
            publishedAt: new Date(nowDate.getTime() - 20 * 60000).toISOString(),
            category: 'Hacim',
          })
        }

        // Halka Arz (IPO) news
        const ipoNews = generateIPONews(nowDate)
        allNews.push(...ipoNews)

        // General market news items
        allNews.push({
          id: 'info-1',
          title: 'BİST işlem saatleri: 09:55 - 18:10',
          summary: 'Borsa İstanbul\'da açılış seansı 09:55\'te başlar, sürekli işlem seansı 10:00-18:00 saatleri arasında gerçekleşir. Veriler 15 dakika gecikmelidir.',
          source: 'BIST Trade',
          url: '#',
          publishedAt: new Date(nowDate.getTime() - 60 * 60000).toISOString(),
          category: 'Bilgi',
        })
      }
    }
  } catch (err) {
    console.error('News generation error:', err)
  }

  if (allNews.length > 0) {
    cachedNews = allNews
    newsCacheTime = now
  }

  return allNews
}

export async function GET() {
  try {
    const news = await fetchFinanceNews()
    return Response.json({ news })
  } catch (err: any) {
    console.error('News API error:', err)
    return Response.json({ news: [] })
  }
}

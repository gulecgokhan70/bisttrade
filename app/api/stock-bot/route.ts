export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcSMA, calcEMA, calcRSI, calcMACD, calcBollinger, generateSignal } from '@/lib/technical-analysis'

export async function POST(request: NextRequest) {
  try {
    const { symbol, timeframe = 'daily' } = await request.json()
    if (!symbol) {
      return NextResponse.json({ error: 'Sembol gerekli' }, { status: 400 })
    }

    // Fetch stock + history
    const stock = await prisma.stock.findFirst({ where: { symbol } })
    if (!stock) {
      return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
    }

    // Fetch more history for weekly/monthly analysis
    const historyLimit = timeframe === 'monthly' ? 365 : timeframe === 'weekly' ? 200 : 200
    const history = await prisma.priceHistory.findMany({
      where: { stockId: stock.id },
      orderBy: { timestamp: 'asc' },
      take: historyLimit,
    })

    if (history.length < 20) {
      return NextResponse.json({ error: 'Yeterli veri yok' }, { status: 400 })
    }

    const closes = history.map((h: any) => h.close)
    const highs = history.map((h: any) => h.high)
    const lows = history.map((h: any) => h.low)

    // Timeframe-specific indicator parameters
    type IndicatorConfig = {
      smaShort: number; smaMid: number; smaLong: number
      emaFast: number; emaSlow: number; rsiPeriod: number
      macdFast: number; macdSlow: number; macdSignal: number
      bbPeriod: number; bbStdDev: number
      pivotLookback: number; levelsLookback: number
      label: string
    }
    const configs: Record<string, IndicatorConfig> = {
      daily: {
        smaShort: 5, smaMid: 10, smaLong: 20,
        emaFast: 9, emaSlow: 21, rsiPeriod: 9,
        macdFast: 5, macdSlow: 13, macdSignal: 6,
        bbPeriod: 15, bbStdDev: 1.8,
        pivotLookback: 5, levelsLookback: 60,
        label: 'Günlük',
      },
      weekly: {
        smaShort: 10, smaMid: 20, smaLong: 50,
        emaFast: 12, emaSlow: 26, rsiPeriod: 14,
        macdFast: 12, macdSlow: 26, macdSignal: 9,
        bbPeriod: 20, bbStdDev: 2.0,
        pivotLookback: 10, levelsLookback: 90,
        label: 'Haftalık',
      },
      monthly: {
        smaShort: 20, smaMid: 50, smaLong: 100,
        emaFast: 21, emaSlow: 55, rsiPeriod: 14,
        macdFast: 12, macdSlow: 26, macdSignal: 9,
        bbPeriod: 20, bbStdDev: 2.0,
        pivotLookback: 20, levelsLookback: 120,
        label: 'Aylık',
      },
    }
    const cfg = configs[timeframe] ?? configs.daily

    const smaShortArr = calcSMA(closes, cfg.smaShort)
    const smaMidArr = calcSMA(closes, cfg.smaMid)
    const smaLongArr = calcSMA(closes, cfg.smaLong)
    const emaFastArr = calcEMA(closes, cfg.emaFast)
    const emaSlowArr = calcEMA(closes, cfg.emaSlow)
    const rsi = calcRSI(closes, cfg.rsiPeriod)
    const macd = calcMACD(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal)
    const bollinger = calcBollinger(closes, cfg.bbPeriod, cfg.bbStdDev)

    // Calculate support/resistance levels
    const recentHighs = highs.slice(-cfg.levelsLookback)
    const recentLows = lows.slice(-cfg.levelsLookback)
    const recentCloses = closes.slice(-cfg.levelsLookback)
    
    // Pivot points
    const lastHigh = Math.max(...recentHighs.slice(-cfg.pivotLookback))
    const lastLow = Math.min(...recentLows.slice(-cfg.pivotLookback))
    const lastClose = closes[closes.length - 1]
    const pivot = (lastHigh + lastLow + lastClose) / 3
    const r1 = 2 * pivot - lastLow
    const r2 = pivot + (lastHigh - lastLow)
    const s1 = 2 * pivot - lastHigh
    const s2 = pivot - (lastHigh - lastLow)

    // Find key levels from recent price action
    const sortedCloses = [...recentCloses].sort((a, b) => a - b)
    const supportZone = sortedCloses[Math.floor(sortedCloses.length * 0.1)] ?? 0
    const resistanceZone = sortedCloses[Math.floor(sortedCloses.length * 0.9)] ?? 0

    // Calculate period change (weekly/monthly)
    let periodChange = ''
    if (timeframe === 'weekly' && closes.length >= 5) {
      const weekAgo = closes[Math.max(0, closes.length - 5)]
      const wChange = ((stock.currentPrice - weekAgo) / weekAgo * 100).toFixed(2)
      periodChange = `Haftalık Değişim: %${wChange}`
    } else if (timeframe === 'monthly' && closes.length >= 22) {
      const monthAgo = closes[Math.max(0, closes.length - 22)]
      const mChange = ((stock.currentPrice - monthAgo) / monthAgo * 100).toFixed(2)
      periodChange = `Aylık Değişim: %${mChange}`
    }

    // Generate signals
    const ohlcvData = history.map((h: any) => ({
      date: (h.timestamp ?? h.date ?? new Date()).toISOString().split('T')[0],
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: Number(h.volume ?? 0),
    }))
    const combinedSignal = generateSignal(ohlcvData, 'COMBINED')
    const smaSignal = generateSignal(ohlcvData, 'SMA_CROSSOVER')
    const rsiSignal = generateSignal(ohlcvData, 'RSI_STRATEGY')
    const macdSignal = generateSignal(ohlcvData, 'MACD_STRATEGY')
    const bollingerSignal = generateSignal(ohlcvData, 'BOLLINGER_STRATEGY')

    // Build context for LLM
    const currentPrice = stock.currentPrice ?? closes[closes.length - 1] ?? 0
    const prevClose = stock.previousClose ?? currentPrice
    const change = currentPrice - prevClose
    const changePct = prevClose ? ((change / prevClose) * 100).toFixed(2) : '0'

    const latestRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null
    const latestMACD = macd.macd.length > 0 ? {
      macdVal: macd.macd[macd.macd.length - 1] ?? 0,
      signalVal: macd.signal[macd.signal.length - 1] ?? 0,
      histogramVal: macd.histogram[macd.histogram.length - 1] ?? 0,
    } : null
    const latestBollinger = bollinger.upper.length > 0 ? {
      upperVal: bollinger.upper[bollinger.upper.length - 1] ?? 0,
      middleVal: bollinger.middle[bollinger.middle.length - 1] ?? 0,
      lowerVal: bollinger.lower[bollinger.lower.length - 1] ?? 0,
    } : null

    const analysisContext = `
Hisse: ${stock.symbol} - ${stock.name}
Sektör: ${stock.sector ?? 'Bilinmiyor'}
Anlık Fiyat: ₺${currentPrice.toFixed(2)}
Günlük Değişim: ₺${change.toFixed(2)} (%${changePct})
${periodChange ? periodChange + '\n' : ''}Gün Yüksek: ₺${(stock.dayHigh ?? currentPrice).toFixed(2)}
Gün Düşük: ₺${(stock.dayLow ?? currentPrice).toFixed(2)}
Hacim: ${stock.volume != null ? Number(stock.volume).toLocaleString('tr-TR') : 'N/A'}

--- ${cfg.label} Teknik Göstergeler ---
SMA(${cfg.smaShort}): ₺${smaShortArr.length > 0 ? (smaShortArr[smaShortArr.length - 1] ?? 0).toFixed(2) : 'N/A'}
SMA(${cfg.smaMid}): ₺${smaMidArr.length > 0 ? (smaMidArr[smaMidArr.length - 1] ?? 0).toFixed(2) : 'N/A'}
SMA(${cfg.smaLong}): ₺${smaLongArr.length > 0 ? (smaLongArr[smaLongArr.length - 1] ?? 0).toFixed(2) : 'N/A'}
EMA(${cfg.emaFast}): ₺${emaFastArr.length > 0 ? (emaFastArr[emaFastArr.length - 1] ?? 0).toFixed(2) : 'N/A'}
EMA(${cfg.emaSlow}): ₺${emaSlowArr.length > 0 ? (emaSlowArr[emaSlowArr.length - 1] ?? 0).toFixed(2) : 'N/A'}
RSI(${cfg.rsiPeriod}): ${latestRSI ? latestRSI.toFixed(2) : 'N/A'}
MACD(${cfg.macdFast},${cfg.macdSlow},${cfg.macdSignal}): ${latestMACD ? `Çizgi: ${latestMACD.macdVal.toFixed(4)}, Sinyal: ${latestMACD.signalVal.toFixed(4)}, Histogram: ${latestMACD.histogramVal.toFixed(4)}` : 'N/A'}
Bollinger(${cfg.bbPeriod},${cfg.bbStdDev}): ${latestBollinger ? `Üst: ₺${latestBollinger.upperVal.toFixed(2)}, Orta: ₺${latestBollinger.middleVal.toFixed(2)}, Alt: ₺${latestBollinger.lowerVal.toFixed(2)}` : 'N/A'}

--- Destek / Direnç ---
Pivot: ₺${pivot.toFixed(2)}
Direnç 1 (R1): ₺${r1.toFixed(2)}
Direnç 2 (R2): ₺${r2.toFixed(2)}
Destek 1 (S1): ₺${s1.toFixed(2)}
Destek 2 (S2): ₺${s2.toFixed(2)}
Destek Bölgesi: ₺${supportZone.toFixed(2)}
Direnç Bölgesi: ₺${resistanceZone.toFixed(2)}

--- Sinyal Özetleri ---
Kombine: ${combinedSignal.signal} (Güven: %${(combinedSignal.confidence * 100).toFixed(0)}) - ${combinedSignal.reason}
SMA Kesişim: ${smaSignal.signal} (Güven: %${(smaSignal.confidence * 100).toFixed(0)}) - ${smaSignal.reason}
RSI: ${rsiSignal.signal} (Güven: %${(rsiSignal.confidence * 100).toFixed(0)}) - ${rsiSignal.reason}
MACD: ${macdSignal.signal} (Güven: %${(macdSignal.confidence * 100).toFixed(0)}) - ${macdSignal.reason}
Bollinger: ${bollingerSignal.signal} (Güven: %${(bollingerSignal.confidence * 100).toFixed(0)}) - ${bollingerSignal.reason}
`

    // Timeframe-specific system prompts
    const systemPrompts: Record<string, string> = {
      daily: `Sen BİST günlük alım satım (day trading) uzmanısın. Türkçe yanıt ver. Kısa vadeli günlük trade analizi yap.
Önemli kurallar:
- GÜNLÜK alım satıma uygun analiz yap (kısa vadeli, hızlı giriş/çıkış)
- Güncel fiyatı esas al, günlük destek ve direnç seviyelerini vurgula
- Giriş fiyatı, hedef fiyat ve zarar kes (stop-loss) seviyesi belirt
- Al/Sat/Bekle önerisi ver
- Risk/ödül oranını hesapla
- Hacim analizini vurgula (günlük trade için çok önemli)
- Emoji kullan (📈📉🎯💡⚠️🟢🔴⏱️)
- Markdown formatı kullan (bold, listeler)
- Maksimum 400 kelime
- Bu bir simülasyondur, gerçek yatırım tavsiyesi değildir diye kısa not ekle`,

      weekly: `Sen BİST haftalık swing trade uzmanısın. Türkçe yanıt ver. Haftalık (1-2 hafta) vade ile analiz yap.
Önemli kurallar:
- HAFTALIK swing trade'e uygun analiz yap (1-2 hafta tutma süresi)
- Güncel fiyatı esas al ve haftalık trend yönünü belirle
- Orta vadeli destek/direnç seviyelerini kullan
- Giriş fiyatı, haftalık hedef fiyat ve zarar kes seviyesi belirt
- Al/Sat/Bekle önerisi ver
- Risk/ödül oranını hesapla
- Trend gücünü ve momentum göstergelerini vurgula
- SMA(10/20/50), RSI(14), MACD(12,26,9) göstergelerini yorumla
- Emoji kullan (📈📉🎯💡⚠️🟢🔴📊)
- Markdown formatı kullan (bold, listeler)
- Maksimum 400 kelime
- Bu bir simülasyondur, gerçek yatırım tavsiyesi değildir diye kısa not ekle`,

      monthly: `Sen BİST aylık pozisyon trade uzmanısın. Türkçe yanıt ver. Aylık (1-3 ay) vade ile analiz yap.
Önemli kurallar:
- AYLIK pozisyon trade'e uygun analiz yap (1-3 ay tutma süresi)
- Güncel fiyatı esas al ve uzun vadeli trend yönünü belirle
- Uzun vadeli destek/direnç seviyelerini ve trend kanallarını kullan
- Giriş fiyatı, aylık hedef fiyat ve zarar kes seviyesi belirt
- Al/Sat/Bekle önerisi ver
- Risk/ödül oranını hesapla
- Uzun vadeli trend, SMA(20/50/100), RSI(14), MACD göstergelerini yorumla
- Sektör ve temel analiz ipuçları ekle
- Emoji kullan (📈📉🎯💡⚠️🟢🔴📊)
- Markdown formatı kullan (bold, listeler)
- Maksimum 400 kelime
- Bu bir simülasyondur, gerçek yatırım tavsiyesi değildir diye kısa not ekle`,
    }

    const systemPrompt = systemPrompts[timeframe] ?? systemPrompts.daily

    const tfLabel = cfg.label
    const userMessage = `Şu hisse için ${tfLabel.toLowerCase()} vadeli detaylı teknik analiz yap (güncel fiyat: ₺${currentPrice.toFixed(2)}):\n${analysisContext}`

    // Call LLM API with streaming
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: true,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      console.error('LLM API error:', response.status)
      return NextResponse.json({ error: 'Analiz servisi şu an kullanılamıyor' }, { status: 502 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        if (!reader) {
          controller.close()
          return
        }
        try {
          let partialRead = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            partialRead += decoder.decode(value, { stream: true })
            const lines = partialRead.split('\n')
            partialRead = lines.pop() || ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch (e) {
                  // skip
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Stock bot error:', error)
    return NextResponse.json({ error: 'Analiz yapılamadı' }, { status: 500 })
  }
}

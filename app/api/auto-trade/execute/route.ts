export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import { generateSignal } from '@/lib/technical-analysis'
import { generateMultiTimeframeAnalysis, type MultiTimeframeData } from '@/lib/technical-indicators'

// Check if BIST market is open (Mon-Fri, 09:55-18:10 Istanbul time)
function isBISTOpen(): boolean {
  const now = new Date()
  const istanbulStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })
  const istanbul = new Date(istanbulStr)
  const day = istanbul.getDay()
  if (day === 0 || day === 6) return false
  const mins = istanbul.getHours() * 60 + istanbul.getMinutes()
  return mins >= 595 && mins <= 1090 // 09:55 - 18:10
}

// MTF cache to avoid fetching for each strategy on same stock
const mtfCache = new Map<string, { data: MultiTimeframeData | null; ts: number }>()
const MTF_CACHE_TTL = 5 * 60 * 1000 // 5 min

async function getMultiTimeframeData(yahooSymbol: string): Promise<MultiTimeframeData | null> {
  const cached = mtfCache.get(yahooSymbol)
  if (cached && Date.now() - cached.ts < MTF_CACHE_TTL) return cached.data
  try {
    const [daily, weekly, monthly] = await Promise.allSettled([
      fetchYahooHistory(yahooSymbol, '3M'),
      fetchYahooHistory(yahooSymbol, '1Y'),
      fetchYahooHistory(yahooSymbol, '5Y'),
    ])
    const d = daily.status === 'fulfilled' ? daily.value : []
    const w = weekly.status === 'fulfilled' ? weekly.value : []
    const m = monthly.status === 'fulfilled' ? monthly.value : []
    if (d.length < 20) { mtfCache.set(yahooSymbol, { data: null, ts: Date.now() }); return null }
    const dc = d.map((x: any) => x.close).filter(Boolean)
    const dv = d.map((x: any) => Number(x.volume || 0))
    const wc = w.map((x: any) => x.close).filter(Boolean)
    const wv = w.map((x: any) => Number(x.volume || 0))
    const mc = m.map((x: any) => x.close).filter(Boolean)
    const mv = m.map((x: any) => Number(x.volume || 0))
    const result = generateMultiTimeframeAnalysis(dc, dv, wc, wv, mc, mv)
    mtfCache.set(yahooSymbol, { data: result, ts: Date.now() })
    return result
  } catch {
    return null
  }
}

// Enhanced signal with multi-timeframe confirmation
function computeEnhancedSignal(
  baseSignal: { signal: 'BUY' | 'SELL' | 'HOLD'; reason: string; confidence: number },
  mtf: MultiTimeframeData | null,
  mode: string
): { signal: 'BUY' | 'SELL' | 'HOLD'; reason: string; confidence: number; mtfInfo?: string } {
  const isAggressive = mode === 'aggressive'
  
  if (!mtf) {
    // No MTF data - use base signal with mode adjustment
    if (isAggressive) {
      // Aggressive: lower confidence threshold, boost confidence
      return { ...baseSignal, confidence: Math.min(baseSignal.confidence + 20, 95) }
    }
    return baseSignal
  }

  let finalSignal = baseSignal.signal
  let finalConf = baseSignal.confidence
  let mtfInfo = `MTF: G=${mtf.daily.signal} H=${mtf.weekly.signal} A=${mtf.monthly.signal} (${mtf.alignment})`
  const reasons = [baseSignal.reason]

  // Multi-timeframe alignment bonus/penalty
  if (mtf.alignment === 'UYUMLU') {
    finalConf += 15
    reasons.push('Çoklu zaman dilimi uyumlu')
    
    // All timeframes agree on direction - strong conviction
    if (mtf.consensus === 'AL' && baseSignal.signal !== 'SELL') {
      finalSignal = 'BUY'
      finalConf += 5
    } else if (mtf.consensus === 'SAT' && baseSignal.signal !== 'BUY') {
      finalSignal = 'SELL'
      finalConf += 5
    }
  } else if (mtf.alignment === 'ZİT') {
    if (!isAggressive) {
      finalConf -= 8
      reasons.push('Zaman dilimleri çelişkili - dikkat')
    } else {
      finalConf -= 2 // Minimal penalty in aggressive mode
      reasons.push('Zaman dilimleri çelişkili')
    }
  } else {
    // KARMA - mixed signals
    // Weekly+Monthly agreement is strong
    if (mtf.weekly.signal === mtf.monthly.signal && mtf.weekly.signal !== 'BEKLE') {
      if (mtf.weekly.signal === 'AL' && baseSignal.signal === 'BUY') {
        finalConf += 10
        reasons.push('Haftalık+Aylık AL uyumu')
      } else if (mtf.weekly.signal === 'SAT' && baseSignal.signal === 'SELL') {
        finalConf += 10
        reasons.push('Haftalık+Aylık SAT uyumu')
      } else if (!isAggressive) {
        // Base signal disagrees with weekly+monthly
        finalConf -= 5
        reasons.push('Uzun vade karşı yön')
      }
    }
  }

  // Aggressive mode adjustments
  if (isAggressive) {
    finalConf += 15 // Güçlü boost
    // In aggressive mode, daily signal has more weight
    if (mtf.daily.signal === 'AL' && finalSignal !== 'SELL') {
      finalConf += 8
    } else if (mtf.daily.signal === 'SAT' && finalSignal !== 'BUY') {
      finalConf += 8
    }
    // Aggressive: if consensus has any direction, override HOLD
    if (finalSignal === 'HOLD' && Math.abs(mtf.consensusScore) > 20) {
      if (mtf.consensusScore > 20) {
        finalSignal = 'BUY'
        reasons.push('Agresif: AL konsensüsü')
      } else if (mtf.consensusScore < -20) {
        finalSignal = 'SELL'
        reasons.push('Agresif: SAT konsensüsü')
      }
    }
  } else {
    // Normal modda da hafif boost
    finalConf += 5
    if (finalSignal === 'HOLD' && Math.abs(mtf.consensusScore) > 50) {
      if (mtf.consensusScore > 50) {
        finalSignal = 'BUY'
        reasons.push('Güçlü AL konsensüsü')
      } else if (mtf.consensusScore < -50) {
        finalSignal = 'SELL'
        reasons.push('Güçlü SAT konsensüsü')
      }
    }
  }

  return {
    signal: finalSignal,
    reason: reasons.join(' · '),
    confidence: Math.max(0, Math.min(finalConf, 95)),
    mtfInfo,
  }
}

export async function POST(request: Request) {
  try {
    // Borsa kapalıyken sinyal kontrolü yapma
    if (!isBISTOpen()) {
      return NextResponse.json({ executed: 0, results: [], marketClosed: true, message: 'Borsa şu an kapalı' })
    }

    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { guestId } = body ?? {}
    const userId = (session?.user as any)?.id || guestId

    if (!userId) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    // Get all active strategies for user
    const strategies = await prisma.autoStrategy.findMany({
      where: { userId, isActive: true },
      include: { stock: true },
    })

    if (strategies.length === 0) {
      return NextResponse.json({ executed: 0, results: [] })
    }

    const results: any[] = []

    // Process each strategy
    for (const strat of strategies) {
      try {
        const mode = (strat as any).mode ?? 'normal'
        const isAggressive = mode === 'aggressive'
        const minConfidence = isAggressive ? 20 : 35

        // Fetch recent history for analysis
        let history: any[] = []
        if (strat.stock.yahooSymbol) {
          history = await fetchYahooHistory(strat.stock.yahooSymbol, '3M')
        }
        if (history.length < 20) {
          results.push({ strategy: strat.id, signal: 'HOLD', reason: 'Yetersiz veri' })
          continue
        }

        const ohlcv = history.map((h: any) => ({
          open: h.open, high: h.high, low: h.low, close: h.close, volume: Number(h.volume ?? 0),
        }))

        // Get base signal from strategy
        const baseSignal = generateSignal(ohlcv, strat.strategy)

        // Get multi-timeframe data
        let mtfData: MultiTimeframeData | null = null
        if (strat.stock.yahooSymbol) {
          mtfData = await getMultiTimeframeData(strat.stock.yahooSymbol)
        }

        // Compute enhanced signal with MTF + mode
        const enhanced = computeEnhancedSignal(baseSignal, mtfData, mode)

        // Update last checked
        await prisma.autoStrategy.update({
          where: { id: strat.id },
          data: { lastChecked: new Date(), lastSignal: enhanced.signal === 'BUY' ? 'BUY' : enhanced.signal === 'SELL' ? 'SELL' : 'HOLD' },
        })

        // Only execute if confidence meets threshold
        if (enhanced.signal === 'HOLD' || enhanced.confidence < minConfidence) {
          results.push({
            strategy: strat.id, symbol: strat.stock.symbol, signal: enhanced.signal,
            reason: enhanced.reason, confidence: enhanced.confidence, executed: false,
            mode, mtfInfo: enhanced.mtfInfo,
          })
          continue
        }

        // Get user's balance and holding
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) continue

        const holding = await prisma.holding.findUnique({
          where: { userId_stockId: { userId, stockId: strat.stockId } },
        })

        const currentPrice = strat.stock.currentPrice
        let qty = 0
        let tradeType = ''

        if (enhanced.signal === 'BUY') {
          const effectiveMaxAmount = isAggressive ? strat.maxAmount * 1.5 : strat.maxAmount
          const effectiveMaxQty = isAggressive ? Math.floor(strat.maxQuantity * 1.5) : strat.maxQuantity
          const maxByAmount = Math.floor(effectiveMaxAmount / currentPrice)
          qty = Math.min(maxByAmount, effectiveMaxQty)
          const totalCost = qty * currentPrice
          if (totalCost > user.cashBalance || qty <= 0) {
            results.push({
              strategy: strat.id, symbol: strat.stock.symbol, signal: enhanced.signal,
              reason: enhanced.reason, confidence: enhanced.confidence, executed: false,
              note: 'Yetersiz bakiye', mode,
            })
            continue
          }
          tradeType = 'BUY'
        } else if (enhanced.signal === 'SELL') {
          if (!holding || holding.quantity <= 0) {
            results.push({
              strategy: strat.id, symbol: strat.stock.symbol, signal: enhanced.signal,
              reason: enhanced.reason, confidence: enhanced.confidence, executed: false,
              note: 'Satılacak hisse yok', mode,
            })
            continue
          }
          const sellRatio = isAggressive ? 1.0 : 0.75 // Aggressive sells all, normal sells 75%
          qty = Math.min(Math.floor(holding.quantity * sellRatio), strat.maxQuantity)
          if (isAggressive) qty = Math.min(Math.floor(holding.quantity), Math.floor(strat.maxQuantity * 1.5))
          if (qty <= 0) {
            results.push({
              strategy: strat.id, symbol: strat.stock.symbol, signal: enhanced.signal,
              reason: enhanced.reason, confidence: enhanced.confidence, executed: false,
              note: 'Satılacak miktar 0', mode,
            })
            continue
          }
          tradeType = 'SELL'
        }

        if (qty <= 0) continue

        // Execute trade
        const totalAmount = qty * currentPrice

        if (tradeType === 'BUY') {
          await prisma.user.update({
            where: { id: userId },
            data: { cashBalance: { decrement: totalAmount } },
          })

          if (holding) {
            const newQty = holding.quantity + qty
            const newAvg = ((holding.avgBuyPrice * holding.quantity) + totalAmount) / newQty
            await prisma.holding.update({
              where: { id: holding.id },
              data: { quantity: newQty, avgBuyPrice: newAvg },
            })
          } else {
            await prisma.holding.create({
              data: { userId, stockId: strat.stockId, quantity: qty, avgBuyPrice: currentPrice },
            })
          }
        } else {
          await prisma.user.update({
            where: { id: userId },
            data: { cashBalance: { increment: totalAmount } },
          })

          if (holding) {
            const newQty = holding.quantity - qty
            if (newQty <= 0) {
              await prisma.holding.delete({ where: { id: holding.id } })
            } else {
              await prisma.holding.update({
                where: { id: holding.id },
                data: { quantity: newQty },
              })
            }
          }
        }

        // Record transaction
        await prisma.transaction.create({
          data: {
            userId,
            stockId: strat.stockId,
            type: tradeType,
            orderType: 'AUTO',
            quantity: qty,
            price: currentPrice,
            totalAmount,
          },
        })

        // Update strategy stats
        const pnl = tradeType === 'SELL' && holding
          ? (currentPrice - holding.avgBuyPrice) * qty
          : 0

        await prisma.autoStrategy.update({
          where: { id: strat.id },
          data: {
            totalTrades: { increment: 1 },
            totalPnL: { increment: pnl },
          },
        })

        results.push({
          strategy: strat.id,
          symbol: strat.stock.symbol,
          signal: enhanced.signal,
          reason: enhanced.reason,
          confidence: enhanced.confidence,
          executed: true,
          tradeType,
          quantity: qty,
          price: currentPrice,
          totalAmount,
          mode,
          mtfInfo: enhanced.mtfInfo,
        })
      } catch (err: any) {
        console.error(`Auto-trade error for strategy ${strat.id}:`, err)
        results.push({ strategy: strat.id, error: err.message })
      }
    }

    return NextResponse.json({
      executed: results.filter((r: any) => r.executed).length,
      results,
    })
  } catch (error: any) {
    console.error('Auto-trade execute error:', error)
    return NextResponse.json({ error: 'İşlem yapılamadı' }, { status: 500 })
  }
}

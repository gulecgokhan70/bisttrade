export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import { generateSignal } from '@/lib/technical-analysis'
import { generateMultiTimeframeAnalysis, type MultiTimeframeData } from '@/lib/technical-indicators'
import { fetchMultiSourceBulkQuotes } from '@/lib/multi-source-finance'

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
  const isUltraAggressive = mode === 'ultra_aggressive'
  
  if (!mtf) {
    if (isUltraAggressive) {
      return { ...baseSignal, confidence: Math.min(baseSignal.confidence + 35, 98) }
    }
    if (isAggressive) {
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
    if (mtf.consensus === 'AL' && baseSignal.signal !== 'SELL') {
      finalSignal = 'BUY'
      finalConf += 5
    } else if (mtf.consensus === 'SAT' && baseSignal.signal !== 'BUY') {
      finalSignal = 'SELL'
      finalConf += 5
    }
  } else if (mtf.alignment === 'ZİT') {
    if (!isAggressive && !isUltraAggressive) {
      finalConf -= 8
      reasons.push('Zaman dilimleri çelişkili - dikkat')
    } else if (isUltraAggressive) {
      // Ultra aggressive ignores contradictions
      finalConf += 5
      reasons.push('Ultra agresif: çelişki görmezden gelindi')
    } else {
      finalConf -= 2
      reasons.push('Zaman dilimleri çelişkili')
    }
  } else {
    if (mtf.weekly.signal === mtf.monthly.signal && mtf.weekly.signal !== 'BEKLE') {
      if (mtf.weekly.signal === 'AL' && baseSignal.signal === 'BUY') {
        finalConf += 10
        reasons.push('Haftalık+Aylık AL uyumu')
      } else if (mtf.weekly.signal === 'SAT' && baseSignal.signal === 'SELL') {
        finalConf += 10
        reasons.push('Haftalık+Aylık SAT uyumu')
      } else if (!isAggressive && !isUltraAggressive) {
        finalConf -= 5
        reasons.push('Uzun vade karşı yön')
      }
    }
  }

  // Mode adjustments
  if (isUltraAggressive) {
    finalConf += 30
    // Ultra: daily signal is king
    if (mtf.daily.signal === 'AL' && finalSignal !== 'SELL') {
      finalConf += 15
      finalSignal = 'BUY'
      reasons.push('Ultra: günlük AL baskın')
    } else if (mtf.daily.signal === 'SAT' && finalSignal !== 'BUY') {
      finalConf += 15
      finalSignal = 'SELL'
      reasons.push('Ultra: günlük SAT baskın')
    }
    // Ultra: override HOLD with any direction
    if (finalSignal === 'HOLD' && Math.abs(mtf.consensusScore) > 10) {
      if (mtf.consensusScore > 10) {
        finalSignal = 'BUY'
        reasons.push('Ultra: AL konsensüsü')
      } else {
        finalSignal = 'SELL'
        reasons.push('Ultra: SAT konsensüsü')
      }
    }
  } else if (isAggressive) {
    finalConf += 15
    if (mtf.daily.signal === 'AL' && finalSignal !== 'SELL') {
      finalConf += 8
    } else if (mtf.daily.signal === 'SAT' && finalSignal !== 'BUY') {
      finalConf += 8
    }
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
    confidence: Math.max(0, Math.min(finalConf, 98)),
    mtfInfo,
  }
}

// Score a stock for full-auto picking (higher = better buy candidate)
function scoreStockForAutoPick(tech: any, mtf: MultiTimeframeData | null): number {
  let score = 0
  
  // RSI oversold = buy opportunity
  if (tech.rsi14 && tech.rsi14 < 30) score += 30
  else if (tech.rsi14 && tech.rsi14 < 40) score += 15
  else if (tech.rsi14 && tech.rsi14 > 70) score -= 20
  
  // MACD bullish
  if (tech.macdHistogram && tech.macdHistogram > 0) score += 10
  
  // Volume spike
  if (tech.volumeRatio && tech.volumeRatio > 1.5) score += 15
  if (tech.volumeRatio && tech.volumeRatio > 2.5) score += 10
  
  // Price near Bollinger lower band = buy
  if (tech.bbPosition && tech.bbPosition < 0.2) score += 20
  
  // Positive change % momentum
  if (tech.changePercent && tech.changePercent > 0 && tech.changePercent < 5) score += 10
  if (tech.changePercent && tech.changePercent > 5) score += 5 // Too high, risky
  if (tech.changePercent && tech.changePercent < -5) score += 15 // Possible dip buy
  
  // MTF alignment
  if (mtf) {
    if (mtf.consensus === 'AL') score += 25
    if (mtf.alignment === 'UYUMLU') score += 15
    if (mtf.consensusScore > 30) score += 10
  }
  
  return score
}

// Full-auto stock selection
async function selectStocksForFullAuto(
  mode: string,
  maxPositions: number,
  existingStockIds: string[]
): Promise<Array<{ stock: any; score: number; mtf: MultiTimeframeData | null }>> {
  try {
    // Get all active stocks
    const allStocks = await prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, symbol: true, yahooSymbol: true, name: true, currentPrice: true },
    })

    // Filter out already held stocks
    const candidates = allStocks.filter(s => !existingStockIds.includes(s.id) && s.currentPrice > 0)

    if (candidates.length === 0) return []

    // Analyze top candidates (limit to avoid too many API calls)
    const toAnalyze = candidates.slice(0, 30) // Analyze up to 30 stocks
    const scored: Array<{ stock: any; score: number; mtf: MultiTimeframeData | null }> = []

    for (const stock of toAnalyze) {
      try {
        if (!stock.yahooSymbol) continue
        
        const history = await fetchYahooHistory(stock.yahooSymbol, '3M')
        if (history.length < 20) continue

        const ohlcv = history.map((h: any) => ({
          open: h.open, high: h.high, low: h.low, close: h.close, volume: Number(h.volume ?? 0),
        }))

        // Generate base signal using COMBINED strategy
        const baseSignal = generateSignal(ohlcv, 'COMBINED')
        
        // Get MTF data
        const mtfData = await getMultiTimeframeData(stock.yahooSymbol)

        // Score this stock
        const closes = history.map((h: any) => h.close)
        const lastClose = closes[closes.length - 1] ?? stock.currentPrice
        const prevClose = closes[closes.length - 2] ?? lastClose
        const changePercent = prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : 0

        // Calculate basic tech metrics for scoring
        const techInfo = {
          rsi14: null as number | null,
          macdHistogram: null as number | null,
          volumeRatio: null as number | null,
          bbPosition: null as number | null,
          changePercent,
        }

        // Simple RSI calculation
        if (closes.length >= 15) {
          let gains = 0, losses = 0
          for (let i = closes.length - 14; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1]
            if (diff > 0) gains += diff
            else losses -= diff
          }
          const avgGain = gains / 14
          const avgLoss = losses / 14
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
          techInfo.rsi14 = 100 - (100 / (1 + rs))
        }

        // Volume ratio
        const volumes = history.map((h: any) => Number(h.volume ?? 0))
        if (volumes.length >= 20) {
          const recent = volumes[volumes.length - 1]
          const avg20 = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
          techInfo.volumeRatio = avg20 > 0 ? recent / avg20 : 1
        }

        const score = scoreStockForAutoPick(techInfo, mtfData)

        // Only include stocks with positive score and BUY signal
        const isUltra = mode === 'ultra_aggressive'
        const minScore = isUltra ? 10 : (mode === 'aggressive' ? 20 : 30)
        
        if (score >= minScore && (baseSignal.signal === 'BUY' || (isUltra && baseSignal.signal !== 'SELL'))) {
          scored.push({ stock, score, mtf: mtfData })
        }
      } catch {
        // Skip failed stocks
        continue
      }
    }

    // Sort by score descending, pick top N
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxPositions)
  } catch (error) {
    console.error('Full-auto stock selection error:', error)
    return []
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

    // Separate full-auto and manual strategies
    const fullAutoStrategies = strategies.filter((s: any) => s.isFullAuto)
    const manualStrategies = strategies.filter((s: any) => !s.isFullAuto)

    // Process FULL AUTO strategies
    for (const strat of fullAutoStrategies) {
      try {
        const mode = (strat as any).mode ?? 'aggressive'
        const isUltra = mode === 'ultra_aggressive'
        const budgetPct = (strat as any).budgetPercent ?? 5
        const maxPos = (strat as any).maxOpenPositions ?? 5

        // Get user portfolio
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) continue

        const holdings = await prisma.holding.findMany({
          where: { userId },
          include: { stock: true },
        })

        // Calculate total portfolio value
        const holdingsValue = holdings.reduce((sum: number, h: any) => sum + (h.quantity * (h.stock?.currentPrice ?? 0)), 0)
        const totalPortfolio = user.cashBalance + holdingsValue
        const budget = totalPortfolio * (budgetPct / 100)
        const perStockBudget = budget / maxPos

        // Current auto-traded stock IDs
        const existingHoldingStockIds = holdings.map((h: any) => h.stockId)
        const activeAutoPositions = holdings.filter((h: any) => h.quantity > 0).length

        // 1. Check existing holdings for SELL signals
        for (const holding of holdings) {
          if (holding.quantity <= 0 || !holding.stock?.yahooSymbol) continue
          try {
            const history = await fetchYahooHistory(holding.stock.yahooSymbol, '3M')
            if (history.length < 20) continue
            const ohlcv = history.map((h: any) => ({ open: h.open, high: h.high, low: h.low, close: h.close, volume: Number(h.volume ?? 0) }))
            const baseSignal = generateSignal(ohlcv, 'COMBINED')
            const mtfData = holding.stock.yahooSymbol ? await getMultiTimeframeData(holding.stock.yahooSymbol) : null
            const enhanced = computeEnhancedSignal(baseSignal, mtfData, mode)

            const sellThreshold = isUltra ? 10 : (mode === 'aggressive' ? 20 : 35)

            if (enhanced.signal === 'SELL' && enhanced.confidence >= sellThreshold) {
              const sellRatio = isUltra ? 1.0 : (mode === 'aggressive' ? 0.85 : 0.75)
              const qty = Math.max(1, Math.floor(holding.quantity * sellRatio))
              const price = holding.stock.currentPrice
              const totalAmount = qty * price

              // Execute sell
              await prisma.user.update({ where: { id: userId }, data: { cashBalance: { increment: totalAmount } } })
              const newQty = holding.quantity - qty
              if (newQty <= 0) {
                await prisma.holding.delete({ where: { id: holding.id } })
              } else {
                await prisma.holding.update({ where: { id: holding.id }, data: { quantity: newQty } })
              }

              const pnl = (price - holding.avgBuyPrice) * qty
              await prisma.transaction.create({
                data: { userId, stockId: holding.stockId, type: 'SELL', orderType: 'AUTO', quantity: qty, price, totalAmount },
              })
              await prisma.autoStrategy.update({ where: { id: strat.id }, data: { totalTrades: { increment: 1 }, totalPnL: { increment: pnl }, lastChecked: new Date(), lastSignal: 'SELL' } })

              results.push({
                strategy: strat.id, symbol: holding.stock.symbol, signal: 'SELL',
                reason: `Tam Oto SAT · ${enhanced.reason}`, confidence: enhanced.confidence,
                executed: true, tradeType: 'SELL', quantity: qty, price, totalAmount,
                mode, fullAuto: true, mtfInfo: enhanced.mtfInfo, pnl,
              })
            }
          } catch { /* skip */ }
        }

        // 2. Select new stocks to BUY (if budget available and under max positions)
        const updatedUser = await prisma.user.findUnique({ where: { id: userId } })
        const updatedHoldings = await prisma.holding.findMany({ where: { userId, quantity: { gt: 0 } } })
        const currentPositionCount = updatedHoldings.length
        const slotsAvailable = maxPos - currentPositionCount
        const availableCash = updatedUser?.cashBalance ?? 0

        if (slotsAvailable > 0 && availableCash > perStockBudget * 0.5) {
          const existingIds = updatedHoldings.map((h: any) => h.stockId)
          const picks = await selectStocksForFullAuto(mode, Math.min(slotsAvailable, 3), existingIds)

          for (const pick of picks) {
            try {
              const currentUser = await prisma.user.findUnique({ where: { id: userId } })
              if (!currentUser || currentUser.cashBalance < perStockBudget * 0.3) break

              const price = pick.stock.currentPrice
              const maxBudgetForStock = Math.min(perStockBudget, currentUser.cashBalance * 0.5)
              const qty = Math.max(1, Math.floor(maxBudgetForStock / price))
              const totalAmount = qty * price

              if (totalAmount > currentUser.cashBalance || qty <= 0) continue

              // Execute buy
              await prisma.user.update({ where: { id: userId }, data: { cashBalance: { decrement: totalAmount } } })

              const existingHolding = await prisma.holding.findUnique({
                where: { userId_stockId: { userId, stockId: pick.stock.id } },
              })

              if (existingHolding) {
                const newQty = existingHolding.quantity + qty
                const newAvg = ((existingHolding.avgBuyPrice * existingHolding.quantity) + totalAmount) / newQty
                await prisma.holding.update({ where: { id: existingHolding.id }, data: { quantity: newQty, avgBuyPrice: newAvg } })
              } else {
                await prisma.holding.create({ data: { userId, stockId: pick.stock.id, quantity: qty, avgBuyPrice: price } })
              }

              await prisma.transaction.create({
                data: { userId, stockId: pick.stock.id, type: 'BUY', orderType: 'AUTO', quantity: qty, price, totalAmount },
              })
              await prisma.autoStrategy.update({ where: { id: strat.id }, data: { totalTrades: { increment: 1 }, lastChecked: new Date(), lastSignal: 'BUY' } })

              results.push({
                strategy: strat.id, symbol: pick.stock.symbol, signal: 'BUY',
                reason: `Tam Oto AL · Skor: ${pick.score}`, confidence: pick.score,
                executed: true, tradeType: 'BUY', quantity: qty, price, totalAmount,
                mode, fullAuto: true, stockName: pick.stock.name,
              })
            } catch (e) {
              console.error('Full-auto buy error:', e)
            }
          }
        }

        // Update last checked
        await prisma.autoStrategy.update({ where: { id: strat.id }, data: { lastChecked: new Date() } })

      } catch (err: any) {
        console.error(`Full-auto error for strategy ${strat.id}:`, err)
        results.push({ strategy: strat.id, error: err.message, fullAuto: true })
      }
    }

    // Process MANUAL strategies (existing logic)
    for (const strat of manualStrategies) {
      try {
        if (!strat.stock) continue
        const mode = (strat as any).mode ?? 'normal'
        const isAggressive = mode === 'aggressive'
        const isUltra = mode === 'ultra_aggressive'
        const minConfidence = isUltra ? 10 : (isAggressive ? 20 : 35)

        let history: any[] = []
        if (strat.stock.yahooSymbol) {
          history = await fetchYahooHistory(strat.stock.yahooSymbol, '3M')
        }
        if (history.length < 20) {
          results.push({ strategy: strat.id, signal: 'HOLD', reason: 'Yetersiz veri' })
          continue
        }

        const ohlcv = history.map((h: any) => ({ open: h.open, high: h.high, low: h.low, close: h.close, volume: Number(h.volume ?? 0) }))
        const baseSignal = generateSignal(ohlcv, strat.strategy)

        let mtfData: MultiTimeframeData | null = null
        if (strat.stock.yahooSymbol) {
          mtfData = await getMultiTimeframeData(strat.stock.yahooSymbol)
        }

        const enhanced = computeEnhancedSignal(baseSignal, mtfData, mode)

        await prisma.autoStrategy.update({
          where: { id: strat.id },
          data: { lastChecked: new Date(), lastSignal: enhanced.signal === 'BUY' ? 'BUY' : enhanced.signal === 'SELL' ? 'SELL' : 'HOLD' },
        })

        if (enhanced.signal === 'HOLD' || enhanced.confidence < minConfidence) {
          results.push({
            strategy: strat.id, symbol: strat.stock.symbol, signal: enhanced.signal,
            reason: enhanced.reason, confidence: enhanced.confidence, executed: false,
            mode, mtfInfo: enhanced.mtfInfo,
          })
          continue
        }

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) continue

        const holding = await prisma.holding.findUnique({
          where: { userId_stockId: { userId, stockId: strat.stockId! } },
        })

        const currentPrice = strat.stock.currentPrice
        let qty = 0
        let tradeType = ''

        if (enhanced.signal === 'BUY') {
          const multiplier = isUltra ? 2.0 : (isAggressive ? 1.5 : 1.0)
          const effectiveMaxAmount = strat.maxAmount * multiplier
          const effectiveMaxQty = Math.floor(strat.maxQuantity * multiplier)
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
          const sellRatio = isUltra ? 1.0 : (isAggressive ? 1.0 : 0.75)
          const maxQtyMultiplier = isUltra ? 2.0 : (isAggressive ? 1.5 : 1.0)
          qty = Math.min(Math.floor(holding.quantity * sellRatio), Math.floor(strat.maxQuantity * maxQtyMultiplier))
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

        const totalAmount = qty * currentPrice

        if (tradeType === 'BUY') {
          await prisma.user.update({ where: { id: userId }, data: { cashBalance: { decrement: totalAmount } } })
          if (holding) {
            const newQty = holding.quantity + qty
            const newAvg = ((holding.avgBuyPrice * holding.quantity) + totalAmount) / newQty
            await prisma.holding.update({ where: { id: holding.id }, data: { quantity: newQty, avgBuyPrice: newAvg } })
          } else {
            await prisma.holding.create({ data: { userId, stockId: strat.stockId!, quantity: qty, avgBuyPrice: currentPrice } })
          }
        } else {
          await prisma.user.update({ where: { id: userId }, data: { cashBalance: { increment: totalAmount } } })
          if (holding) {
            const newQty = holding.quantity - qty
            if (newQty <= 0) {
              await prisma.holding.delete({ where: { id: holding.id } })
            } else {
              await prisma.holding.update({ where: { id: holding.id }, data: { quantity: newQty } })
            }
          }
        }

        await prisma.transaction.create({
          data: { userId, stockId: strat.stockId!, type: tradeType, orderType: 'AUTO', quantity: qty, price: currentPrice, totalAmount },
        })

        const pnl = tradeType === 'SELL' && holding ? (currentPrice - holding.avgBuyPrice) * qty : 0
        await prisma.autoStrategy.update({
          where: { id: strat.id },
          data: { totalTrades: { increment: 1 }, totalPnL: { increment: pnl } },
        })

        results.push({
          strategy: strat.id, symbol: strat.stock.symbol, signal: enhanced.signal,
          reason: enhanced.reason, confidence: enhanced.confidence, executed: true,
          tradeType, quantity: qty, price: currentPrice, totalAmount, mode, mtfInfo: enhanced.mtfInfo,
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

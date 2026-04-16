export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMultiSourceQuote, fetchMultiSourceBulkQuotes } from '@/lib/multi-source-finance'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams?.get('search') ?? ''
    const symbol = searchParams?.get('symbol') ?? ''

    // --- Single stock lookup ---
    if (symbol) {
      const stock = await prisma.stock.findUnique({ where: { symbol } })
      if (!stock) {
        return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
      }

      // Try multiple data sources for real price
      if (stock.yahooSymbol) {
        const quote = await fetchMultiSourceQuote(stock.yahooSymbol, stock.symbol)
        if (quote && quote.currentPrice > 0) {
          // Return live data immediately, persist in background
          const liveStock = {
            ...stock,
            currentPrice: quote.currentPrice,
            previousClose: quote.previousClose,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            volume: quote.volume,
            dataSource: quote.source,
          }
          // Background DB update (don't await)
          prisma.stock.update({
            where: { symbol },
            data: {
              currentPrice: quote.currentPrice,
              previousClose: quote.previousClose,
              dayHigh: quote.dayHigh,
              dayLow: quote.dayLow,
              volume: quote.volume,
            },
          }).catch(() => {})
          return NextResponse.json(liveStock)
        }
      }

      // Return DB price as-is
      return NextResponse.json({ ...stock, dataSource: 'db' })
    }

    // --- Stock list (all or filtered) ---
    let where: any = { isActive: true }
    if (search) {
      where = {
        isActive: true,
        OR: [
          { symbol: { contains: search.toUpperCase(), mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const stocks = await prisma.stock.findMany({
      where,
      orderBy: { symbol: 'asc' },
    })

    // Fetch real prices from multiple sources in bulk
    const yahooSymbols = stocks
      .filter((s: any) => s.yahooSymbol)
      .map((s: any) => s.yahooSymbol as string)

    let multiSourceData = new Map()
    try {
      multiSourceData = await fetchMultiSourceBulkQuotes(yahooSymbols)
    } catch (err) {
      console.error('Bulk multi-source fetch failed, using DB prices:', err)
    }

    // Merge live data with DB records
    const updatedStocks = stocks.map((stock: any) => {
      const liveQuote = stock.yahooSymbol ? multiSourceData.get(stock.yahooSymbol) : null
      if (liveQuote && liveQuote.currentPrice > 0) {
        return {
          ...stock,
          currentPrice: liveQuote.currentPrice,
          previousClose: liveQuote.previousClose,
          dayHigh: liveQuote.dayHigh,
          dayLow: liveQuote.dayLow,
          volume: liveQuote.volume,
          dataSource: liveQuote.source,
        }
      }
      return { ...stock, dataSource: 'db' }
    })

    // Background: persist live prices to DB (fire-and-forget)
    _persistLivePrices(stocks, multiSourceData).catch(() => {})

    return NextResponse.json(updatedStocks)
  } catch (error: any) {
    console.error('Stocks API error:', error)
    return NextResponse.json({ error: 'Hisseler alınamadı' }, { status: 500 })
  }
}

// Persist live prices to DB in background (batched to avoid connection limits)
async function _persistLivePrices(stocks: any[], liveData: Map<string, any>) {
  const toUpdate = stocks.filter((s: any) => {
    const quote = s.yahooSymbol ? liveData.get(s.yahooSymbol) : null
    return quote && quote.currentPrice > 0 && Math.abs(quote.currentPrice - s.currentPrice) > 0.01
  })

  if (toUpdate.length === 0) return

  // Batch updates, 5 at a time
  const BATCH = 5
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map((stock: any) => {
        const quote = liveData.get(stock.yahooSymbol)
        if (!quote) return Promise.resolve()
        return prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice: quote.currentPrice,
            previousClose: quote.previousClose,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            volume: quote.volume,
          },
        }).catch(() => {})
      })
    )
  }
}

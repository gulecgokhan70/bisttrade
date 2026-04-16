'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import {
  Eye, TrendingUp, TrendingDown, Trash2, BarChart3, ArrowRight, Activity, Bot,
  ShoppingCart, ArrowDownCircle, Bell,
} from 'lucide-react'
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/stock-utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function WatchlistContent() {
  const router = useRouter()
  const { userId, isGuest, guestId } = useUserId()
  const [watchlist, setWatchlist] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [liveData, setLiveData] = useState<Record<string, any>>({})

  const fetchWatchlist = useCallback(async () => {
    if (!userId) return
    try {
      const guestParam = isGuest ? `?guestId=${guestId}` : ''
      const headers: any = isGuest ? { 'x-guest-id': guestId } : {}
      const res = await fetch(`/api/watchlist${guestParam}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setWatchlist(data)
      }
    } catch (err) {
      console.error('Watchlist fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isGuest, guestId])

  // Fetch live prices for watchlist stocks
  const fetchLivePrices = useCallback(async () => {
    if (watchlist.length === 0) return
    try {
      const res = await fetch(`/api/stocks?_t=${Date.now()}`)
      if (res.ok) {
        const stocks = await res.json()
        const map: Record<string, any> = {}
        stocks.forEach((s: any) => { map[s.symbol] = s })
        setLiveData(map)
      }
    } catch (err) {
      console.error('Live price fetch error:', err)
    }
  }, [watchlist.length])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  useEffect(() => {
    fetchLivePrices()
    const interval = setInterval(fetchLivePrices, 1000)
    return () => clearInterval(interval)
  }, [fetchLivePrices])

  const removeFromWatchlist = async (symbol: string) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' }
      if (isGuest) headers['x-guest-id'] = guestId
      const res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ symbol }),
      })
      if (res.ok) {
        setWatchlist(prev => prev.filter(w => w.stock.symbol !== symbol))
        toast.success(`${symbol} izleme listesinden çıkarıldı`)
      }
    } catch (err) {
      toast.error('İşlem başarısız')
    }
  }

  const getStockData = (item: any) => {
    const live = liveData[item.stock.symbol]
    if (live) return live
    return item.stock
  }

  // Summary stats
  const totalWatching = watchlist.length
  const gainers = watchlist.filter(item => {
    const s = getStockData(item)
    return s.currentPrice > (s.previousClose || s.currentPrice)
  }).length
  const losers = totalWatching - gainers

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="h-6 w-6 text-primary" /> {`İzleme Listem`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalWatching} hisse izleniyor
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/market')}
            className="gap-1.5"
          >
            <BarChart3 className="h-4 w-4" /> Hisse Ekle
          </Button>
        </div>
      </FadeIn>

      {/* Quick Summary */}
      {!loading && watchlist.length > 0 && (
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-bold font-display">{totalWatching}</p>
                <p className="text-[10px] text-muted-foreground">{`İzlenen`}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-bold font-display text-emerald-500">{gainers}</p>
                <p className="text-[10px] text-muted-foreground">{`Yükselen`}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-bold font-display text-red-500">{losers}</p>
                <p className="text-[10px] text-muted-foreground">{`Düşen`}</p>
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="w-16 h-8 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="p-8 text-center">
              <Eye className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{`İzleme listeniz boş`}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {`Hisse sayfasından veya listeden hisseleri izleme listenize ekleyebilirsiniz.`}
              </p>
              <Button onClick={() => router.push('/dashboard/market')} className="gap-2">
                <BarChart3 className="h-4 w-4" /> {`Hisselere Göz At`}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      ) : (
        <div className="space-y-2">
          {watchlist.map((item, idx) => {
            const stock = getStockData(item)
            const change = stock.currentPrice && stock.previousClose
              ? ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100
              : 0
            const changeColor = getChangeColor(change)
            const changeAmount = stock.currentPrice - (stock.previousClose || stock.currentPrice)

            return (
              <FadeIn key={item.id} delay={idx * 0.05}>
                <Card className="hover:bg-muted/30 transition-all duration-200 group">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Symbol badge */}
                      <button
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors"
                        onClick={() => router.push(`/dashboard/trade?symbol=${stock.symbol}`)}
                      >
                        <span className="text-[10px] font-bold text-primary">{stock.symbol?.slice(0, 3)}</span>
                      </button>

                      {/* Symbol & name */}
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => router.push(`/dashboard/trade?symbol=${stock.symbol}`)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{stock.symbol}</span>
                          {stock.sector && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {stock.sector}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {stock.name}
                        </p>
                      </button>

                      {/* Price & change */}
                      <div className="text-right shrink-0">
                        <p className="font-mono font-semibold text-sm">
                          {formatCurrency(stock.currentPrice)}
                        </p>
                        <div className="flex items-center justify-end gap-1">
                          {change >= 0
                            ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                            : <TrendingDown className="h-3 w-3 text-red-500" />}
                          <span className={cn('text-xs font-mono font-medium', changeColor)}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Quick action buttons */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 text-xs font-bold gap-1"
                          title="Hızlı Al"
                          onClick={() => router.push(`/dashboard/trade?symbol=${stock.symbol}&action=buy`)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> AL
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs font-bold gap-1"
                          title="Hızlı Sat"
                          onClick={() => router.push(`/dashboard/trade?symbol=${stock.symbol}&action=sell`)}
                        >
                          <ArrowDownCircle className="h-3.5 w-3.5" /> SAT
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Alarm Ekle"
                          onClick={() => router.push(`/dashboard/alerts?symbol=${stock.symbol}`)}
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Listeden Çıkar"
                          onClick={() => removeFromWatchlist(stock.symbol)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            )
          })}
        </div>
      )}
    </div>
  )
}

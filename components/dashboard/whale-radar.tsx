'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Fish, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/stock-utils'

interface WhaleStock {
  symbol: string
  name: string
  price: number
  whaleScore: number
  level: string
  trend: string
  netFlow: number
  recentActivity: string
  accDays: number
  distDays: number
  volumeRatio: number
}

export function WhaleRadar() {
  const [stocks, setStocks] = useState<WhaleStock[]>([])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [timestamp, setTimestamp] = useState('')
  const router = useRouter()

  const fetchRadar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/whale-radar')
      const json = await res.json()
      if (res.ok && json.stocks) {
        setStocks(json.stocks)
        setTimestamp(json.timestamp)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRadar()
    // Refresh every 5 min
    const interval = setInterval(fetchRadar, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchRadar])

  const displayed = showAll ? stocks : stocks.slice(0, 5)

  const levelColor = (level: string) => {
    switch (level) {
      case 'YÜKSEK': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
      case 'ORTA': return 'text-amber-400 bg-amber-500/15 border-amber-500/30'
      default: return 'text-zinc-400 bg-zinc-500/15 border-zinc-500/30'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fish className="h-4 w-4 text-cyan-400" />
            Balina Radarı
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={fetchRadar}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Bugün en yüksek balina aktivitesi</p>
      </CardHeader>
      <CardContent>
        {loading && stocks.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Taranıyor...</span>
          </div>
        )}

        {stocks.length > 0 && (
          <div className="space-y-1">
            {displayed.map((stock, idx) => (
              <button
                key={stock.symbol}
                className="flex items-center justify-between w-full px-2.5 py-2 hover:bg-muted/50 transition-colors rounded-lg text-left group"
                onClick={() => router.push(`/dashboard/trade?symbol=${stock.symbol}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground/60 w-4 shrink-0">{idx + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Fish className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono font-semibold text-sm group-hover:text-primary transition-colors">{stock.symbol}</p>
                      <Badge variant="outline" className={cn('text-[9px] px-1 py-0 border', levelColor(stock.level))}>
                        {stock.whaleScore}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{stock.name}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="flex items-center justify-end gap-1">
                    {stock.netFlow > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    ) : stock.netFlow < 0 ? (
                      <ArrowDownRight className="h-3 w-3 text-red-400" />
                    ) : null}
                    <span className={cn('text-xs font-mono font-bold',
                      stock.netFlow > 0 ? 'text-emerald-400' : stock.netFlow < 0 ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                      {stock.netFlow > 0 ? '+' : ''}{stock.netFlow}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">{stock.volumeRatio}x hacim</p>
                </div>
              </button>
            ))}
            {stocks.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Daha az göster' : `Tümünü göster (${stocks.length})`}
              </Button>
            )}
          </div>
        )}

        {!loading && stocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Balina verisi yükleniyor...</p>
        )}

        <p className="text-[10px] text-yellow-500/60 text-center mt-2">
          ⚠️ Hacim paternlerinden üretilen tahmindir
        </p>
      </CardContent>
    </Card>
  )
}

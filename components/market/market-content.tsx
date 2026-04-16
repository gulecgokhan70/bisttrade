'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import { Search, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw, Wifi, Bot, Clock } from 'lucide-react'
import { formatCurrency, formatPercent, getChangeColor, getBgChangeColor, formatNumber } from '@/lib/stock-utils'

function isBISTOpen(): boolean {
  const now = new Date()
  const istanbul = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const day = istanbul.getDay()
  if (day === 0 || day === 6) return false
  const mins = istanbul.getHours() * 60 + istanbul.getMinutes()
  return mins >= 600 && mins <= 1090 // 10:00 - 18:10
}

export function MarketContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stocks, setStocks] = useState<any[]>([])
  const [search, setSearch] = useState(searchParams?.get('search') ?? '')
  const [sectorFilter, setSectorFilter] = useState('Tümü')
  const [sortBy, setSortBy] = useState<string>('symbol')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [marketOpen, setMarketOpen] = useState(true)

  // Check market status periodically
  useEffect(() => {
    setMarketOpen(isBISTOpen())
    const interval = setInterval(() => setMarketOpen(isBISTOpen()), 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStocks = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const t = Date.now()
      const res = await fetch(`/api/stocks${search ? `?search=${encodeURIComponent(search)}&_t=${t}` : `?_t=${t}`}`)
      if (res?.ok) {
        const data = await res.json()
        setStocks(data ?? [])
        setLastUpdated(new Date())
      }
    } catch (err: any) {
      console.error('Fetch stocks error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search])

  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  useEffect(() => {
    const interval = setInterval(() => fetchStocks(), 1000) // 1s auto-refresh
    return () => clearInterval(interval)
  }, [fetchStocks])

  const sectors = ['Tümü', ...Array.from(new Set((stocks ?? []).map((s: any) => s?.sector).filter(Boolean)))]

  const filteredStocks = (stocks ?? [])
    .filter((s: any) => sectorFilter === 'Tümü' || s?.sector === sectorFilter)
    .sort((a: any, b: any) => {
      let aVal: any, bVal: any
      if (sortBy === 'symbol') { aVal = a?.symbol ?? ''; bVal = b?.symbol ?? '' }
      else if (sortBy === 'price') { aVal = a?.currentPrice ?? 0; bVal = b?.currentPrice ?? 0 }
      else if (sortBy === 'change') {
        aVal = ((a?.currentPrice ?? 0) - (a?.previousClose ?? 0)) / (a?.previousClose ?? 1)
        bVal = ((b?.currentPrice ?? 0) - (b?.previousClose ?? 0)) / (b?.previousClose ?? 1)
      }
      else if (sortBy === 'volume') { aVal = a?.volume ?? 0; bVal = b?.volume ?? 0 }
      else { aVal = a?.symbol ?? ''; bVal = b?.symbol ?? '' }

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">BİST Hisse Listesi</h1>
            <p className="text-sm text-muted-foreground mt-1">BİST 500 hisselerini takip edin ve işlem yapın</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wifi className={`h-3 w-3 ${marketOpen ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
                <span>{marketOpen ? '15 dk gecikmeli veri' : 'Borsa kapalı'} · {lastUpdated.toLocaleTimeString('tr-TR')}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStocks(true)}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Market Status Banner */}
      {!marketOpen && (
        <FadeIn delay={0.05}>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 shrink-0">
              <Clock className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Borsa Şu An Kapalı</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                BİST işlem saatleri: Pazartesi - Cuma, 10:00 - 18:10 · Fiyatlar son kapanış verilerini yansıtmaktadır
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hisse ara..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {sectors.map((sector: any) => (
              <Button
                key={sector}
                variant={sectorFilter === sector ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSectorFilter(sector)}
                className="text-xs"
              >
                {sector}
              </Button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Stocks Table */}
      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {[
                      { key: 'symbol', label: 'Sembol' },
                      { key: 'price', label: 'Fiyat' },
                      { key: 'change', label: 'Değişim' },
                      { key: 'volume', label: 'Hacim' },
                    ].map((col: any) => (
                      <th
                        key={col?.key}
                        className="text-left text-xs font-medium text-muted-foreground px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => toggleSort(col?.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col?.label}
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                    ))}
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(8)].map((_: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredStocks.map((stock: any) => {
                      const change = (stock?.currentPrice ?? 0) - (stock?.previousClose ?? 0)
                      const changePercent = (stock?.previousClose ?? 1) !== 0
                        ? (change / (stock?.previousClose ?? 1)) * 100
                        : 0
                      return (
                        <tr
                          key={stock?.id}
                          className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/trade?symbol=${stock?.symbol}`)}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-mono font-semibold text-sm">{stock?.symbol}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{stock?.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-sm font-medium transition-all duration-300">{formatCurrency(stock?.currentPrice)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${getBgChangeColor(change)}`}>
                              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatPercent(changePercent)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-sm text-muted-foreground">{formatNumber(stock?.volume)}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation()
                                  router.push(`/dashboard/trade?symbol=${stock?.symbol}`)
                                }}
                              >
                                Trade
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs gap-1 text-muted-foreground hover:text-primary"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation()
                                  router.push(`/dashboard/auto-trade?symbol=${stock?.symbol}`)
                                }}
                                title="Oto Al/Sat stratejisi kur"
                              >
                                <Bot className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/ui/animate'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  TrendingUp, TrendingDown, ArrowRight, Activity,
  Radar, Zap, ArrowUpRight, ArrowDownRight, BarChart3, Filter, Shield, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/stock-utils'
import { NewsFeed } from './news-feed'
import { WhaleRadar } from './whale-radar'
import { PremiumGate } from '@/components/premium-gate'
import { BeginnerGuide } from './beginner-guide'
function isBISTOpen(): boolean {
  const now = new Date()
  const istanbul = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const day = istanbul.getDay()
  if (day === 0 || day === 6) return false
  const mins = istanbul.getHours() * 60 + istanbul.getMinutes()
  return mins >= 595 && mins <= 1090 // 09:55 - 18:10
}

export function DashboardContent() {
  const { userId, isGuest } = useUserId()
  const router = useRouter()
  const [stocks, setStocks] = useState<any[]>([])
  const [scannerData, setScannerData] = useState<any[]>([])
  const [scannerCategories, setScannerCategories] = useState<string[]>([])
  const [activeCategories, setActiveCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [scannerTotal, setScannerTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [marketOpen, setMarketOpen] = useState(true)
  const [allScannerData, setAllScannerData] = useState<any[]>([])
  const [showAllScanner, setShowAllScanner] = useState(false)
  const [mobileTab, setMobileTab] = useState<'movers' | 'scanner' | 'whale'>('movers')

  // Locked ranking: symbol order fixed every 30 min, prices update live
  const [lockedGainerSymbols, setLockedGainerSymbols] = useState<string[]>([])
  const [lockedLoserSymbols, setLockedLoserSymbols] = useState<string[]>([])
  const lastRankingTime = useRef<number>(0)
  const RANKING_INTERVAL = 60 * 60 * 1000 // 1 saat

  // Check market status periodically
  useEffect(() => {
    setMarketOpen(isBISTOpen())
    const interval = setInterval(() => setMarketOpen(isBISTOpen()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch only stock prices (fast, every 1s)
  const fetchStocks = useCallback(async () => {
    try {
      const t = Date.now()
      const res = await fetch(`/api/stocks?_t=${t}`)
      if (res?.ok) {
        const sData = await res.json()
        setStocks(sData ?? [])
      }
    } catch (err: any) {
      console.error('Dashboard stocks fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch scanner data (heavy, every 15 min) - always fetch ALL, filter client-side
  const fetchScanner = useCallback(async () => {
    try {
      const t = Date.now()
      const res = await fetch(`/api/scanner?_t=${t}`)
      if (res?.ok) {
        const scData = await res.json()
        setAllScannerData(scData?.opportunities ?? [])
        setScannerCategories(scData?.categories ?? [])
        setActiveCategories(scData?.activeCategories ?? [])
        setScannerTotal(scData?.totalFound ?? 0)
      }
    } catch (err: any) {
      console.error('Dashboard scanner fetch error:', err)
    }
  }, [])

  // Client-side category filtering
  useEffect(() => {
    if (selectedCategory === 'ALL') {
      setScannerData(allScannerData)
    } else {
      setScannerData(allScannerData.filter((opp: any) => opp?.category === selectedCategory))
    }
    setShowAllScanner(false)
  }, [selectedCategory, allScannerData])

  // Initial load
  useEffect(() => {
    if (userId) {
      fetchStocks()
      fetchScanner()
    }
  }, [userId, fetchStocks, fetchScanner])

  // Stock prices: refresh every 1s
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(fetchStocks, 30000)
    return () => clearInterval(interval)
  }, [userId, fetchStocks])

  // Scanner: refresh every 15 min
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(fetchScanner, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [userId, fetchScanner])

  // Recompute ranking only every 30 min (or on first load)
  useEffect(() => {
    if ((stocks ?? []).length === 0) return
    const now = Date.now()
    if (lockedGainerSymbols.length > 0 && now - lastRankingTime.current < RANKING_INTERVAL) return

    const withChange = stocks
      .filter((s: any) => (s?.currentPrice ?? 0) > 0 && (s?.previousClose ?? 0) > 0)
      .map((s: any) => ({
        symbol: s.symbol,
        pct: ((s.currentPrice - s.previousClose) / s.previousClose) * 100,
      }))

    const gainers = [...withChange].filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5).map(s => s.symbol)
    const losers = [...withChange].filter(s => s.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5).map(s => s.symbol)

    setLockedGainerSymbols(gainers)
    setLockedLoserSymbols(losers)
    lastRankingTime.current = now
  }, [stocks]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- All hooks are above this line ---

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_: any, i: number) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 w-24 skeleton-shimmer rounded mb-3" />
                <div className="h-8 w-32 skeleton-shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="h-4 w-40 skeleton-shimmer rounded mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 skeleton-shimmer rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-20 skeleton-shimmer rounded" />
                    <div className="h-3 w-32 skeleton-shimmer rounded" />
                  </div>
                  <div className="h-6 w-16 skeleton-shimmer rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Market sentiment calculations
  const risingCount = (stocks ?? []).filter((s: any) => (s?.currentPrice ?? 0) > (s?.previousClose ?? 0)).length
  const fallingCount = (stocks ?? []).filter((s: any) => (s?.currentPrice ?? 0) < (s?.previousClose ?? 0)).length
  const unchangedCount = (stocks ?? []).length - risingCount - fallingCount
  const totalStocks = (stocks ?? []).length
  const risingPercent = totalStocks > 0 ? (risingCount / totalStocks) * 100 : 0
  const sentiment: 'bull' | 'bear' | 'neutral' = risingPercent > 60 ? 'bull' : risingPercent < 40 ? 'bear' : 'neutral'
  const sentimentLabel = sentiment === 'bull' ? 'Boğa' : sentiment === 'bear' ? 'Ayı' : 'Nötr'
  const sentimentColor = sentiment === 'bull' ? 'text-emerald-400' : sentiment === 'bear' ? 'text-red-400' : 'text-amber-400'
  const sentimentBg = sentiment === 'bull' ? 'bg-emerald-500/15' : sentiment === 'bear' ? 'bg-red-500/15' : 'bg-amber-500/15'

  // Resolve live data for locked symbols (prices update every 1s via stocks)
  const stockMap = new Map((stocks ?? []).map((s: any) => [s.symbol, s]))

  const topGainers = lockedGainerSymbols
    .map(sym => stockMap.get(sym))
    .filter(Boolean)
    .map((s: any) => ({
      ...s,
      _change: (s.currentPrice ?? 0) - (s.previousClose ?? 0),
      _changePct: (s.previousClose ?? 0) > 0 ? (((s.currentPrice ?? 0) - (s.previousClose ?? 0)) / s.previousClose) * 100 : 0,
    }))

  const topLosers = lockedLoserSymbols
    .map(sym => stockMap.get(sym))
    .filter(Boolean)
    .map((s: any) => ({
      ...s,
      _change: (s.currentPrice ?? 0) - (s.previousClose ?? 0),
      _changePct: (s.previousClose ?? 0) > 0 ? (((s.currentPrice ?? 0) - (s.previousClose ?? 0)) / s.previousClose) * 100 : 0,
    }))

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Piyasa</h1>
        </div>
      </FadeIn>

      {/* Beginner Guide */}
      <FadeIn delay={0.05}>
        <BeginnerGuide />
      </FadeIn>

      {/* Market Sentiment */}
      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-8">
              <div className="flex items-center gap-5">
                <div className={`flex items-center justify-center w-14 h-14 rounded-xl ${sentimentBg}`}>
                  {sentiment === 'bull' ? (
                    <TrendingUp className={`h-7 w-7 ${sentimentColor}`} />
                  ) : sentiment === 'bear' ? (
                    <TrendingDown className={`h-7 w-7 ${sentimentColor}`} />
                  ) : (
                    <Activity className={`h-7 w-7 ${sentimentColor}`} />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm text-foreground mb-1">Piyasa Duyarlılığı</p>
                  <p className={`font-display text-xl font-bold ${sentimentColor}`}>{sentimentLabel} Piyasa</p>
                </div>
              </div>

              <div className="w-full h-px bg-border/60" />

              <div className="flex items-center justify-center gap-10 sm:gap-14 flex-wrap">
                <div className="text-center min-w-[60px]">
                  <p className="text-2xl font-bold text-emerald-400 mb-1">{risingCount}</p>
                  <p className="text-xs text-foreground font-medium">Yükselen</p>
                </div>
                <div className="text-center min-w-[60px]">
                  <p className="text-2xl font-bold text-red-400 mb-1">{fallingCount}</p>
                  <p className="text-xs text-foreground font-medium">Düşen</p>
                </div>
                <div className="text-center min-w-[60px]">
                  <p className="text-2xl font-bold text-amber-400 mb-1">{unchangedCount}</p>
                  <p className="text-xs text-foreground font-medium">Değişmez</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <div className="w-32 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                    style={{ width: `${risingPercent}%` }}
                  />
                </div>
                <span className="text-sm text-foreground font-mono font-medium">{risingPercent.toFixed(0)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* === Desktop: 3 kolon yan yana | Mobil: Sekmeli (tab) === */}
      <FadeIn delay={0.2}>
        {/* Mobil Sekmeler */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Piyasa Hareketleri</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => router.push('/dashboard/market')}>
              Tüm Piyasa <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex rounded-xl bg-muted/50 p-1 mb-4">
            {[
              { key: 'movers', label: 'Yükselen/Düşen', icon: <BarChart3 className="h-3.5 w-3.5" /> },
              { key: 'scanner', label: 'Fırsat', icon: <Radar className="h-3.5 w-3.5" /> },
              { key: 'whale', label: 'Balina', icon: <Zap className="h-3.5 w-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMobileTab(tab.key as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  mobileTab === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobil: Yükselen/Düşen */}
          {mobileTab === 'movers' && (
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-1 px-3 pt-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Yükselen
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  {topGainers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Veri yok</p>
                  ) : (
                    <div className="px-1.5">
                      {topGainers.map((stock: any, idx: number) => (
                        <button
                          key={stock?.id}
                          className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-muted/50 transition-colors rounded-lg text-left"
                          onClick={() => router.push(`/dashboard/trade?symbol=${stock?.symbol}`)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[9px] font-bold text-muted-foreground/60 w-3 shrink-0">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-xs truncate">{stock?.symbol}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-500 shrink-0">+{stock._changePct.toFixed(1)}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 px-3 pt-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    Düşen
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  {topLosers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Veri yok</p>
                  ) : (
                    <div className="px-1.5">
                      {topLosers.map((stock: any, idx: number) => (
                        <button
                          key={stock?.id}
                          className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-muted/50 transition-colors rounded-lg text-left"
                          onClick={() => router.push(`/dashboard/trade?symbol=${stock?.symbol}`)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[9px] font-bold text-muted-foreground/60 w-3 shrink-0">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-xs truncate">{stock?.symbol}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-red-400 shrink-0">{stock._changePct.toFixed(1)}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mobil: Fırsat Tarayıcı */}
          {mobileTab === 'scanner' && (
            <PremiumGate feature="Fırsat Tarayıcı">
              {isGuest ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <Radar className="w-8 h-8 text-primary" />
                    <p className="text-sm text-muted-foreground">Kayıt olmanız gerekmektedir.</p>
                    <Button size="sm" onClick={() => router.push('/signup')} className="bg-gradient-to-r from-primary to-emerald-500 text-white">Kayıt Ol</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2 px-3 pt-3">
                    <div className="flex items-center gap-2">
                      <Radar className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">Fırsat Tarayıcı</CardTitle>
                      {scannerData.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">{scannerData.length}</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <button onClick={() => setSelectedCategory('ALL')} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${selectedCategory === 'ALL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                        <Filter className="h-2.5 w-2.5" /> Tümü
                      </button>
                      {scannerCategories.map((cat: string) => {
                        const isActive = activeCategories.includes(cat)
                        const isSelected = selectedCategory === cat
                        return (
                          <button key={cat} onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)} disabled={!isActive && !isSelected}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${isSelected ? 'bg-primary text-primary-foreground border-primary' : isActive ? 'bg-muted/50 text-muted-foreground border-border/50' : 'bg-muted/20 text-muted-foreground/40 border-transparent cursor-not-allowed'}`}>{cat}</button>
                        )
                      })}
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    {scannerData.length === 0 ? (
                      <div className="text-center py-6">
                        <Radar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Fırsat tespit edilemedi</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {scannerData.slice(0, showAllScanner ? 50 : 4).map((opp: any) => {
                          const isUp = (opp?.changePercent ?? 0) >= 0
                          const isBuySignal = ['AL FIRSATI', 'GÜVENLİ AL', 'MACD CROSSOVER', 'AŞIRI SATIM', 'GOLDEN CROSS', 'BOLLINGER DIP', 'DÖNÜŞ FIRSATI'].includes(opp?.category)
                          const simpleSignal = isBuySignal ? 'AL' : opp?.category === 'DÜŞÜŞ' ? 'SAT' : 'BEKLE'
                          const simpleSignalColor = simpleSignal === 'AL' ? 'bg-emerald-500 text-white' : simpleSignal === 'SAT' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                          return (
                            <button key={opp?.id} className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-all text-left" onClick={() => router.push(`/dashboard/trade?symbol=${opp?.symbol}`)}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${simpleSignalColor}`}>{simpleSignal}</span>
                                <div className="min-w-0">
                                  <p className="font-mono font-bold text-xs">{opp?.symbol}</p>
                                  <p className="text-[9px] text-muted-foreground truncate max-w-[100px]">{opp?.name}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-mono text-xs font-semibold">{formatCurrency(opp?.currentPrice)}</p>
                                <span className={`text-[10px] font-mono font-bold ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>{formatPercent(opp?.changePercent)}</span>
                              </div>
                            </button>
                          )
                        })}
                        {scannerData.length > 4 && (
                          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllScanner(!showAllScanner)}>
                            {showAllScanner ? 'Daha Az' : `+${scannerData.length - 4} fırsat daha`}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </PremiumGate>
          )}

          {/* Mobil: Balina Radarı */}
          {mobileTab === 'whale' && (
            <PremiumGate feature="Balina Radarı">
              <WhaleRadar />
            </PremiumGate>
          )}
        </div>

        {/* Desktop: 2 satır × 2 kolon */}
        <div className="hidden lg:block space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold">Piyasa Hareketleri</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => router.push('/dashboard/market')}>
              Tüm Piyasa <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Satır 1: Yükselen | Düşen */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  En Çok Yükselen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {topGainers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Yükselen hisse yok</p>
                ) : (
                  <div className="px-2">
                    {topGainers.map((stock: any, idx: number) => (
                      <button key={stock?.id} className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/50 transition-colors rounded-lg text-left group" onClick={() => router.push(`/dashboard/trade?symbol=${stock?.symbol}`)}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground/60 w-4 shrink-0">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-emerald-500">{stock.symbol?.slice(0, 2)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-semibold text-sm truncate group-hover:text-primary transition-colors">{stock?.symbol}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{stock?.name}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="font-mono text-sm font-medium">{formatCurrency(stock?.currentPrice)}</p>
                          <div className="flex items-center justify-end gap-0.5">
                            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            <span className="text-xs font-mono font-bold text-emerald-500">+{stock._changePct.toFixed(2)}%</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/10">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </div>
                  En Çok Düşen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {topLosers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Düşen hisse yok</p>
                ) : (
                  <div className="px-2">
                    {topLosers.map((stock: any, idx: number) => (
                      <button key={stock?.id} className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/50 transition-colors rounded-lg text-left group" onClick={() => router.push(`/dashboard/trade?symbol=${stock?.symbol}`)}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground/60 w-4 shrink-0">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-red-300">{stock.symbol?.slice(0, 2)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-semibold text-sm truncate group-hover:text-primary transition-colors">{stock?.symbol}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{stock?.name}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="font-mono text-sm font-medium">{formatCurrency(stock?.currentPrice)}</p>
                          <div className="flex items-center justify-end gap-0.5">
                            <ArrowDownRight className="h-3 w-3 text-red-400" />
                            <span className="text-xs font-mono font-bold text-red-400">{stock._changePct.toFixed(2)}%</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Satır 2: Fırsat Tarayıcı | Balina Radarı */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <PremiumGate feature="Fırsat Tarayıcı">
              {isGuest ? (
                <Card className="h-full">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Radar className="w-8 h-8 text-primary" />
                    <h3 className="text-base font-bold">Fırsat Tarayıcı</h3>
                    <p className="text-xs text-muted-foreground">Kayıt olmanız gerekmektedir.</p>
                    <Button size="sm" onClick={() => router.push('/signup')} className="bg-gradient-to-r from-primary to-emerald-500 text-white">Kayıt Ol</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10">
                        <Radar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">Fırsat Tarayıcı</CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          RSI, MA, hacim analizi
                          {scannerData.length > 0 && <span className="text-primary font-medium ml-1">({scannerData.length})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <button onClick={() => setSelectedCategory('ALL')} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${selectedCategory === 'ALL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                        <Filter className="h-2.5 w-2.5" /> Tümü
                      </button>
                      {scannerCategories.map((cat: string) => {
                        const isActive = activeCategories.includes(cat)
                        const isSelected = selectedCategory === cat
                        return (
                          <button key={cat} onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)} disabled={!isActive && !isSelected}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${isSelected ? 'bg-primary text-primary-foreground border-primary' : isActive ? 'bg-muted/50 text-muted-foreground border-border/50' : 'bg-muted/20 text-muted-foreground/40 border-transparent cursor-not-allowed'}`}>{cat}</button>
                        )
                      })}
                    </div>
                    {!marketOpen && (
                      <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-amber-500 text-xs">⏰</span>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">Borsa kapalı</p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto max-h-[500px]">
                    {scannerData.length === 0 ? (
                      <div className="text-center py-6">
                        <Radar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {selectedCategory !== 'ALL' ? `"${selectedCategory}" kategorisinde fırsat yok` : 'Fırsat tespit edilemedi'}
                        </p>
                        {selectedCategory !== 'ALL' && (
                          <Button variant="outline" size="sm" className="mt-2 text-[10px]" onClick={() => setSelectedCategory('ALL')}>Tümü Göster</Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {scannerData.slice(0, showAllScanner ? 50 : 4).map((opp: any) => {
                          const isUp = (opp?.changePercent ?? 0) >= 0
                          const categoryColor = getCategoryColor(opp?.category)
                          const isBuySignal = ['AL FIRSATI', 'GÜVENLİ AL', 'MACD CROSSOVER', 'AŞIRI SATIM', 'GOLDEN CROSS', 'BOLLINGER DIP', 'DÖNÜŞ FIRSATI'].includes(opp?.category)
                          const simpleSignal = isBuySignal ? 'AL' : opp?.category === 'DÜŞÜŞ' ? 'SAT' : 'BEKLE'
                          const simpleSignalColor = simpleSignal === 'AL' ? 'bg-emerald-500 text-white' : simpleSignal === 'SAT' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                          return (
                            <div key={opp?.id} className="p-2.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer" onClick={() => router.push(`/dashboard/trade?symbol=${opp?.symbol}`)}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${simpleSignalColor}`}>{simpleSignal}</span>
                                  <p className="font-mono font-bold text-xs">{opp?.symbol}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono text-xs font-semibold">{formatCurrency(opp?.currentPrice)}</p>
                                  <span className={`text-[10px] font-mono font-bold ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>{formatPercent(opp?.changePercent)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 font-semibold border ${categoryColor}`}>{opp?.category}</Badge>
                                {opp?.rsi14 !== null && opp?.rsi14 !== undefined && (
                                  <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded ${opp.rsi14 <= 30 ? 'bg-emerald-500/15 text-emerald-500' : opp.rsi14 >= 70 ? 'bg-red-500/15 text-red-500' : 'bg-muted text-muted-foreground'}`}>RSI {opp.rsi14}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {scannerData.length > 4 && (
                          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllScanner(!showAllScanner)}>
                            {showAllScanner ? 'Daha Az' : `+${scannerData.length - 4} fırsat daha`}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </PremiumGate>
            </div>

            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <PremiumGate feature="Balina Radarı">
              <WhaleRadar />
            </PremiumGate>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Haber Akışı */}
      <NewsFeed />
    </div>
  )
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'GÜVENLİ AL': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
    case 'MACD CROSSOVER': return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20'
    case 'AL FIRSATI': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'DÖNÜŞ FIRSATI': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'AŞIRI SATIM': return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
    case 'GOLDEN CROSS': return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
    case 'BOLLINGER DIP': return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    case 'HACİM PATLAMASI': return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20'
    case 'VOLATİL': return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20'
    case 'YÜKSEK HACİM': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case 'YÜKSELİŞ': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'DÜŞÜŞ': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    default: return 'bg-muted text-muted-foreground border-border/50'
  }
}

function getReliabilityColor(reliability: string): string {
  switch (reliability) {
    case 'ÇOK_YÜKSEK': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    case 'YÜKSEK': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
    case 'ORTA': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
    case 'DÜŞÜK': return 'bg-red-500/10 text-red-400 border border-red-500/20'
    default: return 'bg-muted text-muted-foreground'
  }
}

function getReliabilityLabel(reliability: string): string {
  switch (reliability) {
    case 'ÇOK_YÜKSEK': return 'Çok Yüksek'
    case 'YÜKSEK': return 'Yüksek'
    case 'ORTA': return 'Orta'
    case 'DÜŞÜK': return 'Düşük'
    default: return reliability
  }
}
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useUserId } from '@/hooks/use-user-id'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import {
  Wallet, TrendingUp, TrendingDown, Briefcase, Banknote, Bot,
  Search, Flame, BarChart3, Sparkles, ArrowRight, Activity,
  ChevronRight, Shield, AlertTriangle, Zap, Target, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/stock-utils'
import { PortfolioChart } from './portfolio-chart'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export function PortfolioContent() {
  const { userId, isGuest, guestId } = useUserId()
  const router = useRouter()
  const [portfolio, setPortfolio] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Empty portfolio search & suggestions state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [topGainers, setTopGainers] = useState<any[]>([])
  const [topVolume, setTopVolume] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const searchTimeoutRef = useRef<any>(null)

  // Analysis state
  const [analysis, setAnalysis] = useState<any>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null)

  // Portfolio history for P&L chart
  const [history, setHistory] = useState<any[]>([])
  const [historyPeriod, setHistoryPeriod] = useState('30')
  const [recentTx, setRecentTx] = useState<any[]>([])

  const fetchPortfolio = useCallback(async () => {
    if (!userId) return
    try {
      const guestParam = isGuest ? `?guestId=${guestId}` : ''
      const sep = guestParam ? '&' : '?'
      const res = await fetch(`/api/portfolio${guestParam}${sep}_t=${Date.now()}`)
      if (res?.ok) {
        const data = await res.json()
        setPortfolio(data)
      }
    } catch (err: any) {
      console.error('Portfolio fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isGuest, guestId])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  useEffect(() => {
    if (!userId) return
    const interval = setInterval(fetchPortfolio, 1000)
    return () => clearInterval(interval)
  }, [userId, fetchPortfolio])

  // Fetch portfolio history for P&L chart
  useEffect(() => {
    if (!userId) return
    const fetchHistory = async () => {
      try {
        const guestParam = isGuest ? `&guestId=${guestId}` : ''
        const res = await fetch(`/api/portfolio/history?days=${historyPeriod}${guestParam}`)
        if (res?.ok) {
          const data = await res.json()
          setHistory(data?.snapshots ?? [])
          setRecentTx(data?.recentTransactions ?? [])
        }
      } catch (err: any) {
        console.error('Portfolio history error:', err)
      }
    }
    fetchHistory()
  }, [userId, isGuest, guestId, historyPeriod])

  const historyChartData = useMemo(() => {
    return history.map((s: any) => ({
      date: new Date(s.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      value: s.totalValue,
      pnl: s.totalValue - 100000,
    }))
  }, [history])

  // Fetch suggestions (top gainers & volume) for empty portfolio
  useEffect(() => {
    let cancelled = false
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/stocks')
        if (!res?.ok) return
        const stocks = await res.json()
        if (cancelled || !Array.isArray(stocks)) return

        // Top gainers: highest % change
        const withChange = stocks
          .filter((s: any) => s.currentPrice > 0 && s.previousClose > 0)
          .map((s: any) => ({
            ...s,
            change: ((s.currentPrice - s.previousClose) / s.previousClose) * 100,
          }))

        const gainers = [...withChange].sort((a: any, b: any) => b.change - a.change).slice(0, 5)
        const byVolume = [...withChange].sort((a: any, b: any) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5)

        if (!cancelled) {
          setTopGainers(gainers)
          setTopVolume(byVolume)
          setSuggestionsLoading(false)
        }
      } catch {
        if (!cancelled) setSuggestionsLoading(false)
      }
    }
    fetchSuggestions()
    return () => { cancelled = true }
  }, [])

  // Fetch portfolio analysis (once, not on every refresh)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function fetchAnalysis() {
      setAnalysisLoading(true)
      try {
        const guestParam = isGuest ? `?guestId=${guestId}` : ''
        const res = await fetch(`/api/portfolio/analysis${guestParam}`)
        if (res?.ok && !cancelled) {
          const data = await res.json()
          setAnalysis(data)
        }
      } catch {}
      if (!cancelled) setAnalysisLoading(false)
    }
    fetchAnalysis()
    // Refresh analysis every 5 min
    const iv = setInterval(fetchAnalysis, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [userId, isGuest, guestId])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks?search=${encodeURIComponent(searchQuery.trim())}`)
        if (res?.ok) {
          const data = await res.json()
          setSearchResults(Array.isArray(data) ? data.slice(0, 8) : [])
        }
      } catch { /* ignore */ }
      setSearching(false)
    }, 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery])

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_: any, i: number) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-24" />
          </Card>
        ))}
      </div>
    )
  }

  // Guest restriction
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Briefcase className="w-10 h-10 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Portföy Yönetimi</h2>
          <p className="text-muted-foreground max-w-md">
            Portföy yönetimi, sermaye takibi ve yatırım analizi özelliklerini kullanmak için kayıt olmanız gerekmektedir.
          </p>
        </div>
        <Button
          onClick={() => router.push('/auth/register')}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-3 text-lg"
        >
          Kayıt Ol
        </Button>
        <p className="text-sm text-muted-foreground">
          Zaten hesabınız var mı?{' '}
          <button onClick={() => router.push('/auth/login')} className="text-amber-500 hover:underline">
            Giriş Yap
          </button>
        </p>
      </div>
    )
  }

  const holdings = portfolio?.holdings ?? []
  const hasHoldings = holdings.length > 0

  // Stock row component for suggestions
  const StockRow = ({ stock, showChange = true }: { stock: any; showChange?: boolean }) => {
    const change = stock.previousClose > 0
      ? ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100
      : (stock.change ?? 0)
    return (
      <button
        onClick={() => router.push(`/dashboard/trade?symbol=${stock.symbol}`)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg text-left text-foreground"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">{stock.symbol?.slice(0, 2)}</span>
          </div>
          <div className="min-w-0">
            <p className="font-mono font-semibold text-sm text-foreground truncate">{stock.symbol}</p>
            <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="font-mono text-sm font-medium text-foreground">{formatCurrency(stock.currentPrice)}</p>
          {showChange && (
            <p className={`text-xs font-mono ${getChangeColor(change)}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </p>
          )}
        </div>
      </button>
    )
  }

  // --- EMPTY PORTFOLIO: Search & Suggestions ---
  if (!hasHoldings) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Portföy</h1>
            <p className="text-sm text-muted-foreground mt-1">Hisselerinizi ve performansınızı takip edin</p>
          </div>
        </FadeIn>

        {/* Cash Balance Card */}
        <SlideIn from="bottom" delay={0}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Wallet className="h-4 w-4" /> Nakit Bakiye
                  </div>
                  <p className="font-display text-2xl font-bold tracking-tight">
                    {formatCurrency(portfolio?.cashBalance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-2">Yatırıma hazır</p>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        {/* Search Box */}
        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <Briefcase className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <h2 className="font-display text-lg font-semibold">Henüz hisseniz yok</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hisse arayarak yatırıma başlayın
                </p>
              </div>
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hisse ara... (örn: THYAO, Garanti)"
                  value={searchQuery}
                  onChange={(e: any) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Search Results */}
              {searchQuery.trim() && (
                <div className="mt-3 max-w-md mx-auto">
                  {searching ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">Aranıyor...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">Sonuç bulunamadı</div>
                  ) : (
                    <div className="divide-y rounded-lg border overflow-hidden">
                      {searchResults.map((s: any) => (
                        <StockRow key={s.symbol} stock={s} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Suggestions */}
        {!searchQuery.trim() && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Gainers */}
            <FadeIn delay={0.15}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    En Çok Yükselenler
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  {suggestionsLoading ? (
                    <div className="space-y-2 p-4">
                      {[...Array(3)].map((_: any, i: number) => (
                        <div key={i} className="h-12 bg-muted/50 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : topGainers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Veri yok</p>
                  ) : (
                    <div className="px-2">
                      {topGainers.map((s: any) => (
                        <StockRow key={s.symbol} stock={s} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>

            {/* Top Volume */}
            <FadeIn delay={0.2}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    En Yüksek Hacim
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  {suggestionsLoading ? (
                    <div className="space-y-2 p-4">
                      {[...Array(3)].map((_: any, i: number) => (
                        <div key={i} className="h-12 bg-muted/50 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : topVolume.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Veri yok</p>
                  ) : (
                    <div className="px-2">
                      {topVolume.map((s: any) => (
                        <StockRow key={s.symbol} stock={s} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        )}

        {/* Quick Action */}
        <FadeIn delay={0.25}>
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Tüm hisseleri incele</p>
                  <p className="text-xs text-muted-foreground mt-0.5">BİST hisselerini listeleyin ve trade yapın</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => router.push('/dashboard/trade')}
                >
                  Trade <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    )
  }

  // Score bar helper
  const ScoreBar = ({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) => {
    const normalized = Math.round(((score + 100) / 200) * 100) // 0-100
    const barColor = score >= 40 ? 'bg-emerald-500' : score >= 15 ? 'bg-green-500' : score > -15 ? 'bg-yellow-500' : score > -40 ? 'bg-orange-500' : 'bg-red-500'
    return (
      <div className={`w-full ${size === 'sm' ? 'h-1.5' : 'h-2.5'} bg-muted rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.max(5, normalized)}%` }} />
      </div>
    )
  }

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'GÜÇLÜ AL': return <Zap className="h-4 w-4 text-emerald-500" />
      case 'AL': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'TUT': return <Shield className="h-4 w-4 text-yellow-500" />
      case 'SAT': return <TrendingDown className="h-4 w-4 text-orange-500" />
      case 'GÜÇLÜ SAT': return <AlertTriangle className="h-4 w-4 text-red-500" />
      default: return <Target className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getPortfolioScoreColor = (score: number) => {
    if (score >= 40) return 'text-emerald-500'
    if (score >= 15) return 'text-green-500'
    if (score > -15) return 'text-yellow-500'
    if (score > -40) return 'text-orange-500'
    return 'text-red-500'
  }

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'yükseliş': return { label: 'Yükseliş', color: 'text-emerald-500', icon: '📈' }
      case 'düşüş': return { label: 'Düşüş', color: 'text-red-500', icon: '📉' }
      default: return { label: 'Yatay', color: 'text-yellow-500', icon: '➡️' }
    }
  }

  // --- FILLED PORTFOLIO ---
  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Portföy</h1>
          <p className="text-sm text-muted-foreground mt-1">Hisselerinizi ve performansınızı takip edin</p>
        </div>
      </FadeIn>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SlideIn from="bottom" delay={0}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Banknote className="h-4 w-4" /> Toplam Değer
              </div>
              <p className="font-display text-2xl font-bold tracking-tight">
                {formatCurrency(portfolio?.totalPortfolioValue)}
              </p>
            </CardContent>
          </Card>
        </SlideIn>
        <SlideIn from="bottom" delay={0.05}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wallet className="h-4 w-4" /> Nakit Bakiye
              </div>
              <p className="font-display text-2xl font-bold tracking-tight">
                {formatCurrency(portfolio?.cashBalance)}
              </p>
            </CardContent>
          </Card>
        </SlideIn>
        <SlideIn from="bottom" delay={0.1}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Briefcase className="h-4 w-4" /> Yatırım
              </div>
              <p className="font-display text-2xl font-bold tracking-tight">
                {formatCurrency(portfolio?.totalHoldingsValue)}
              </p>
            </CardContent>
          </Card>
        </SlideIn>
        <SlideIn from="bottom" delay={0.15}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                {(portfolio?.totalPnL ?? 0) >= 0
                  ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                  : <TrendingDown className="h-4 w-4 text-red-500" />}
                Toplam Kar/Zarar
              </div>
              <p className={`font-display text-2xl font-bold tracking-tight ${getChangeColor(portfolio?.totalPnL)}`}>
                {formatCurrency(portfolio?.totalPnL)} ({formatPercent(portfolio?.totalPnLPercent)})
              </p>
            </CardContent>
          </Card>
        </SlideIn>
      </div>

      {/* Portfolio Analysis Score */}
      <FadeIn delay={0.2}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Portföy Analizi
              </CardTitle>
              {analysis && !analysisLoading && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Genel Puan</p>
                    <p className={`font-display text-xl font-bold ${getPortfolioScoreColor(analysis.portfolioScore)}`}>
                      {analysis.portfolioScore > 0 ? '+' : ''}{analysis.portfolioScore}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    analysis.portfolioRating === 'GÜÇLÜ' ? 'bg-emerald-500/10 text-emerald-500' :
                    analysis.portfolioRating === 'İYİ' ? 'bg-green-500/10 text-green-500' :
                    analysis.portfolioRating === 'NÖTR' ? 'bg-yellow-500/10 text-yellow-500' :
                    analysis.portfolioRating === 'ZAYIF' ? 'bg-orange-500/10 text-orange-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {analysis.portfolioRating}
                  </div>
                </div>
              )}
            </div>
            {analysis && !analysisLoading && (
              <div className="mt-2">
                <ScoreBar score={analysis.portfolioScore} />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {analysisLoading ? (
              <div className="px-4 pb-4 space-y-3">
                {[...Array(3)].map((_: any, i: number) => (
                  <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                ))}
                <p className="text-xs text-center text-muted-foreground">Teknik analiz yapılıyor...</p>
              </div>
            ) : analysis?.analyses?.length > 0 ? (
              <div className="divide-y">
                {analysis.analyses.map((a: any) => {
                  const h = holdings.find((h: any) => h?.stock?.symbol === a.symbol)
                  const isExpanded = expandedAnalysis === a.symbol
                  const trendInfo = getTrendLabel(a.trend)
                  return (
                    <div key={a.symbol} className="transition-colors hover:bg-muted/30">
                      {/* Main Row — Clickable */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                        onClick={() => router.push(`/dashboard/trade?symbol=${a.symbol}`)}
                      >
                        {/* Rating Icon */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                          a.score >= 15 ? 'bg-emerald-500/10' : a.score > -15 ? 'bg-yellow-500/10' : 'bg-red-500/10'
                        }`}>
                          {getRatingIcon(a.rating)}
                        </div>

                        {/* Symbol + Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-bold text-sm">{a.symbol}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              a.ratingColor?.replace('text-', 'bg-').replace('500', '500/15')
                            } ${a.ratingColor}`}>
                              {a.rating}
                            </span>
                            <span className={`text-[10px] ${trendInfo.color}`}>{trendInfo.icon}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.name}</p>
                        </div>

                        {/* Score + Bar */}
                        <div className="w-24 shrink-0 hidden sm:block">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">Puan</span>
                            <span className={`text-xs font-bold font-mono ${a.ratingColor}`}>
                              {a.score > 0 ? '+' : ''}{a.score}
                            </span>
                          </div>
                          <ScoreBar score={a.score} size="sm" />
                        </div>

                        {/* P&L */}
                        {h && (
                          <div className="text-right shrink-0 hidden md:block w-24">
                            <p className={`font-mono text-sm font-medium ${getChangeColor(h?.pnl)}`}>
                              {formatCurrency(h?.pnl)}
                            </p>
                            <p className={`text-[10px] font-mono ${getChangeColor(h?.pnlPercent)}`}>
                              {formatPercent(h?.pnlPercent)}
                            </p>
                          </div>
                        )}

                        {/* Expand + Navigate */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            onClick={(e) => { e.stopPropagation(); setExpandedAnalysis(isExpanded ? null : a.symbol) }}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 space-y-3">
                          {/* Quick Stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="bg-muted/40 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-muted-foreground">RSI</p>
                              <p className={`font-mono text-sm font-bold ${
                                a.rsi !== null ? (a.rsi > 70 ? 'text-red-500' : a.rsi < 30 ? 'text-emerald-500' : 'text-foreground') : 'text-muted-foreground'
                              }`}>
                                {a.rsi !== null ? a.rsi.toFixed(0) : '—'}
                              </p>
                            </div>
                            <div className="bg-muted/40 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-muted-foreground">MACD</p>
                              <p className={`font-mono text-sm font-bold ${
                                a.macdSignal === 'pozitif' ? 'text-emerald-500' : a.macdSignal === 'negatif' ? 'text-red-500' : 'text-muted-foreground'
                              }`}>
                                {a.macdSignal ?? '—'}
                              </p>
                            </div>
                            <div className="bg-muted/40 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-muted-foreground">SMA(20)</p>
                              <p className={`font-mono text-sm font-bold ${
                                a.smaPosition === 'üzerinde' ? 'text-emerald-500' : a.smaPosition === 'altında' ? 'text-red-500' : 'text-muted-foreground'
                              }`}>
                                {a.smaPosition ?? '—'}
                              </p>
                            </div>
                            <div className="bg-muted/40 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-muted-foreground">Volatilite</p>
                              <p className="font-mono text-sm font-bold">
                                {a.volatility !== null ? `%${a.volatility.toFixed(1)}` : '—'}
                              </p>
                            </div>
                          </div>

                          {/* Reasons */}
                          <div className="space-y-1">
                            {(a.reasons ?? []).map((r: string, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="shrink-0 mt-0.5">•</span>
                                <span>{r}</span>
                              </p>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => router.push(`/dashboard/trade?symbol=${a.symbol}`)}>
                              <BarChart3 className="h-3.5 w-3.5" /> Trade
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => router.push(`/dashboard/analysis?symbol=${a.symbol}`)}>
                              <Activity className="h-3.5 w-3.5" /> Detaylı Analiz
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => router.push(`/dashboard/auto-trade?symbol=${a.symbol}`)}>
                              <Bot className="h-3.5 w-3.5" /> Oto Al/Sat
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
                Analiz verisi bulunamadı
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* P&L Performance Chart */}
      <FadeIn delay={0.22}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {`Portföy Değer Geçmişi`}
              </CardTitle>
              <div className="flex gap-1">
                {[['7', '7G'], ['30', '1A'], ['90', '3A'], ['365', '1Y']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setHistoryPeriod(val)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      historyPeriod === val
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historyChartData.length > 1 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tickFormatter={(v: number) => `₺${(v/1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [`₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, 'Toplam']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(217 91% 60%)"
                      strokeWidth={2}
                      fill="url(#pnlGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                {`Henüz yeterli veri yok. İşlem yaptıkça grafik oluşacaktır.`}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Recent Transactions */}
      {recentTx.length > 0 && (
        <FadeIn delay={0.24}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {`Son İşlemler`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentTx.slice(0, 5).map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.type === 'BUY' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                      }`}>
                        {tx.type === 'BUY'
                          ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                          : <TrendingDown className="h-4 w-4 text-red-500" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">{tx.symbol}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            tx.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                          }`}>
                            {tx.type === 'BUY' ? 'AL' : 'SAT'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tx.quantity} adet @ {formatCurrency(tx.price)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium">{formatCurrency(tx.totalAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Portfolio Chart */}
      <FadeIn delay={0.25}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Portföy Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <PortfolioChart holdings={holdings} cashBalance={portfolio?.cashBalance ?? 0} />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Holdings Table — Clickable Rows */}
      <FadeIn delay={0.3}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hisselerim</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Hisse</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Adet</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Ort. Maliyet</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Güncel</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Değer</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Kar/Zarar</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Puan</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h: any) => {
                    const a = analysis?.analyses?.find((a: any) => a.symbol === h?.stock?.symbol)
                    return (
                      <tr
                        key={h?.id}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/dashboard/trade?symbol=${h?.stock?.symbol}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                              <span className="text-[10px] font-bold text-primary">{h?.stock?.symbol?.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="font-mono font-semibold text-sm group-hover:text-primary transition-colors">{h?.stock?.symbol}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{h?.stock?.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">{h?.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm hidden sm:table-cell">{formatCurrency(h?.avgBuyPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(h?.stock?.currentPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm hidden sm:table-cell">{formatCurrency(h?.currentValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-sm ${getChangeColor(h?.pnl)}`}>
                            {formatCurrency(h?.pnl)}
                          </span>
                          <br />
                          <span className={`text-xs font-mono ${getChangeColor(h?.pnlPercent)}`}>
                            ({formatPercent(h?.pnlPercent)})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`text-xs font-bold ${a.ratingColor}`}>{a.score > 0 ? '+' : ''}{a.score}</span>
                              {getRatingIcon(a.rating)}
                            </div>
                          ) : analysisLoading ? (
                            <div className="w-8 h-4 bg-muted/50 animate-pulse rounded mx-auto" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
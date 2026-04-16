'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { TakasSection } from '@/components/trade/takas-section'
import { WhaleSection } from '@/components/trade/whale-section'
import { PremiumGate } from '@/components/premium-gate'
import { TechnicalPanel } from '@/components/trade/technical-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  TrendingUp, TrendingDown, ArrowUpDown, BarChart3, Activity,
  AlertCircle, CheckCircle2, Clock, ListOrdered, X, Bot, Eye, EyeOff, Wallet,
} from 'lucide-react'
import {
  formatCurrency, formatPercent, formatNumber, getChangeColor, getBgChangeColor,
  getOrderTypeLabel, getOrderStatusLabel, getOrderStatusColor,
} from '@/lib/stock-utils'
import { cn } from '@/lib/utils'
import { StockChart } from './stock-chart'
import { StockBot } from './stock-bot'
import { TradeSuitability } from './trade-suitability'
import { toast } from 'sonner'
export function TradeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { userId, isGuest, guestId } = useUserId()
  const [stocks, setStocks] = useState<any[]>([])
  const [selectedStock, setSelectedStock] = useState<any>(null)

  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY')
  const [orderType, setOrderType] = useState('MARKET')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [trailingPercent, setTrailingPercent] = useState('')
  const [cashBalance, setCashBalance] = useState(0)
  const [userHolding, setUserHolding] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [period, setPeriod] = useState('1D')
  const [chartType, setChartType] = useState<'candle' | 'area'>('area')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [inWatchlist, setInWatchlist] = useState(false)
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null)

  // BIST market hours check (Mon-Fri 10:00-18:00 Istanbul / UTC+3)
  const isBistOpen = useCallback(() => {
    const now = new Date()
    // Istanbul is UTC+3
    const utcH = now.getUTCHours()
    const utcM = now.getUTCMinutes()
    const istH = (utcH + 3) % 24
    const istMin = utcM
    const day = now.getUTCDay() // 0=Sun
    // adjust day if +3 rolls over midnight
    const istDay = (utcH + 3 >= 24) ? (day + 1) % 7 : day
    if (istDay === 0 || istDay === 6) return false // weekend
    const istTime = istH * 60 + istMin
    return istTime >= 600 && istTime < 1080 // 10:00 - 18:00
  }, [])

  const [marketOpen, setMarketOpen] = useState(true)
  useEffect(() => {
    setMarketOpen(isBistOpen())
    const iv = setInterval(() => setMarketOpen(isBistOpen()), 60000)
    return () => clearInterval(iv)
  }, [isBistOpen])

  // Fetch stock list
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks')
        if (res?.ok) {
          const data = await res.json()
          setStocks(data ?? [])
        }
      } catch (err: any) { console.error(err) }
    }
    fetchStocks()
  }, [])

  // Select stock from URL param (only on initial load / param change — NOT on every selectedStock update)
  const initialSelectionDone = useRef(false)
  useEffect(() => {
    const sym = searchParams?.get('symbol')
    if (sym && (stocks?.length ?? 0) > 0) {
      // Only set from stocks array if symbol actually changed or first time
      if (!initialSelectionDone.current || selectedStock?.symbol !== sym) {
        const found = stocks.find((s: any) => s?.symbol === sym)
        if (found) {
          setSelectedStock(found)
          initialSelectionDone.current = true
        }
      }
    } else if (!selectedStock && (stocks?.length ?? 0) > 0) {
      setSelectedStock(stocks[0])
      initialSelectionDone.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, stocks])

  // AbortController ref to cancel in-flight history requests on period change
  const historyAbortRef = useRef<AbortController | null>(null)

  // Fetch selected stock data + history with abort support
  useEffect(() => {
    if (!selectedStock?.symbol) return

    // Cancel any in-flight history request
    historyAbortRef.current?.abort()
    const abortController = new AbortController()
    historyAbortRef.current = abortController

    const fetchData = async () => {
      try {
        const [stockRes, histRes] = await Promise.all([
          fetch(`/api/stocks?symbol=${selectedStock.symbol}`),
          fetch(`/api/stocks/${selectedStock.symbol}/history?period=${period}`, {
            signal: abortController.signal,
          }),
        ])
        if (abortController.signal.aborted) return
        if (stockRes?.ok) {
          const data = await stockRes.json()
          setSelectedStock(data)
        }
        if (histRes?.ok) {
          const hist = await histRes.json()
          if (!abortController.signal.aborted) {
            setPriceHistory(hist ?? [])
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error(err)
      }
    }
    fetchData()

    return () => { abortController.abort() }
  }, [selectedStock?.symbol, period])

  // Auto-refresh price + chart together every 1s (synchronized, cache-busted)
  useEffect(() => {
    if (!selectedStock?.symbol) return
    const interval = setInterval(async () => {
      try {
        const t = Date.now()
        const [stockRes, histRes] = await Promise.all([
          fetch(`/api/stocks?symbol=${selectedStock.symbol}&_t=${t}`),
          fetch(`/api/stocks/${selectedStock.symbol}/history?period=${period}&_t=${t}`),
        ])
        if (stockRes?.ok) {
          const data = await stockRes.json()
          setSelectedStock(data)
        }
        if (histRes?.ok) {
          const hist = await histRes.json()
          setPriceHistory(hist ?? [])
        }
        // Check pending orders in background
        fetch('/api/orders/check', { method: 'POST' }).catch(() => {})
      } catch (err: any) { console.error(err) }
    }, 15000)
    return () => clearInterval(interval)
  }, [selectedStock?.symbol, period])

  // Fetch user portfolio info
  useEffect(() => {
    if (!userId || !selectedStock?.id) return
    const fetchPortfolio = async () => {
      try {
        const guestParam = isGuest ? `?guestId=${guestId}` : ''
        const res = await fetch(`/api/portfolio${guestParam}`)
        if (res?.ok) {
          const data = await res.json()
          setCashBalance(data?.cashBalance ?? 0)
          const holding = (data?.holdings ?? []).find((h: any) => h?.stockId === selectedStock?.id)
          setUserHolding(holding ?? null)
        }
      } catch (err: any) { console.error(err) }
    }
    fetchPortfolio()
  }, [userId, isGuest, guestId, selectedStock?.id])

  // Fetch pending orders
  useEffect(() => {
    if (!userId) return
    const fetchOrders = async () => {
      try {
        const guestParam = isGuest ? `?guestId=${guestId}&` : '?'
        const res = await fetch(`/api/orders${guestParam}status=PENDING`)
        if (res?.ok) {
          const data = await res.json()
          setPendingOrders(data ?? [])
        }
      } catch (err: any) { console.error(err) }
    }
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [userId, isGuest, guestId])

  // Check if selected stock is in watchlist
  useEffect(() => {
    if (!userId || !selectedStock?.symbol) return
    const checkWatchlist = async () => {
      try {
        const guestParam = isGuest ? `?guestId=${guestId}` : ''
        const headers: any = isGuest ? { 'x-guest-id': guestId } : {}
        const res = await fetch(`/api/watchlist${guestParam}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setInWatchlist(data.some((w: any) => w.stock?.symbol === selectedStock.symbol))
        }
      } catch {}
    }
    checkWatchlist()
  }, [userId, selectedStock?.symbol, isGuest, guestId])

  const toggleWatchlist = async () => {
    if (!selectedStock?.symbol) return
    try {
      const headers: any = { 'Content-Type': 'application/json' }
      if (isGuest) headers['x-guest-id'] = guestId
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers,
        body: JSON.stringify({ symbol: selectedStock.symbol }),
      })
      if (res.ok) {
        const data = await res.json()
        setInWatchlist(data.action === 'added')
        toast.success(data.action === 'added'
          ? `${selectedStock.symbol} izleme listesine eklendi`
          : `${selectedStock.symbol} izleme listesinden çıkarıldı`)
      }
    } catch {
      toast.error('İşlem başarısız')
    }
  }

  const handleTrade = async () => {
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Geçerli bir miktar girin')
      return
    }

    if (orderType === 'MARKET') {
      const totalCost = qty * (selectedStock?.currentPrice ?? 0)
      if (tradeType === 'BUY' && totalCost > cashBalance) {
        toast.error('Yetersiz bakiye')
        return
      }
      if (tradeType === 'SELL' && qty > (userHolding?.quantity ?? 0)) {
        toast.error('Yetersiz hisse')
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedStock?.symbol,
          quantity: qty,
          type: tradeType,
          orderType,
          limitPrice: limitPrice || undefined,
          stopPrice: stopPrice || undefined,
          trailingPercent: trailingPercent || undefined,
          guestId: isGuest ? guestId : undefined,
        }),
      })
      const data = await res?.json()
      if (res?.ok) {
        toast.success(data?.message ?? 'Emir oluşturuldu!')
        setQuantity('')
        setLimitPrice('')
        setStopPrice('')
        setTrailingPercent('')
        // Refresh portfolio
        const guestParam = isGuest ? `?guestId=${guestId}` : ''
        const pRes = await fetch(`/api/portfolio${guestParam}`)
        if (pRes?.ok) {
          const pData = await pRes.json()
          setCashBalance(pData?.cashBalance ?? 0)
          const holding = (pData?.holdings ?? []).find((h: any) => h?.stockId === selectedStock?.id)
          setUserHolding(holding ?? null)
        }
        // Refresh orders
        const oRes = await fetch(`/api/orders${isGuest ? `?guestId=${guestId}&` : '?'}status=PENDING`)
        if (oRes?.ok) {
          const oData = await oRes.json()
          setPendingOrders(oData ?? [])
        }
      } else {
        toast.error(data?.error ?? 'Emir başarısız')
      }
    } catch (err: any) {
      console.error('Trade error:', err)
      toast.error('İşlem gerçekleştirilemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      const guestParam = isGuest ? `&guestId=${guestId}` : ''
      const res = await fetch(`/api/orders?id=${orderId}${guestParam}`, { method: 'DELETE' })
      if (res?.ok) {
        toast.success('Emir iptal edildi')
        setPendingOrders((prev) => prev.filter((o: any) => o.id !== orderId))
      }
    } catch (err: any) {
      toast.error('Emir iptal edilemedi')
    }
  }

  // Always use live API price for display (most reliable source)
  const livePrice = selectedStock?.currentPrice ?? 0
  const displayPrice = hoveredPrice ?? livePrice

  // For 1D: use live API's previousClose (reliable)
  // For other periods: use chart's first data point as period start
  const periodStartPrice = period === '1D'
    ? (selectedStock?.previousClose ?? 0)
    : (priceHistory?.length ?? 0) > 0
      ? (priceHistory[0]?.close ?? 0)
      : (selectedStock?.previousClose ?? 0)
  const change = displayPrice - periodStartPrice
  const changePercent = periodStartPrice !== 0
    ? (change / periodStartPrice) * 100
    : 0

  const periodLabels: Record<string, string> = { '1D': 'Günlük', '1W': 'Haftalık', '1M': 'Aylık', '3M': '3 Aylık', '1Y': 'Yıllık', '5Y': '5 Yıllık' }
  const currentPeriodLabel = periodLabels[period] ?? 'Günlük'

  const totalCost = parseFloat(quantity || '0') * (selectedStock?.currentPrice ?? 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">{'Alım Satım'}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{'BİST hisseleri ile alım satım yapın'}</p>
        </div>
      </FadeIn>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Chart + Stock Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stock Selector */}
          <FadeIn delay={0.05}>
            <Card>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                {selectedStock ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 shrink-0">
                        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-base sm:text-lg leading-tight">{selectedStock?.symbol}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">{selectedStock?.name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-7 w-7 sm:h-8 sm:w-8 shrink-0', inWatchlist ? 'text-primary' : 'text-muted-foreground')}
                        title={inWatchlist ? 'İzleme listesinden çıkar' : 'İzleme listesine ekle'}
                        onClick={toggleWatchlist}
                      >
                        {inWatchlist ? <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                      </Button>
                      <a
                        href={`https://t.me/b0pt_bot?start=${selectedStock.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex items-center justify-center h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-[#29B6F6] hover:bg-[#29B6F6]/10 transition-colors"
                        title="BOPT Canlı Veri"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      </a>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-base sm:text-lg transition-all duration-300">{formatCurrency(displayPrice)}</p>
                      <span className={`text-[11px] sm:text-xs font-mono transition-colors duration-300 ${getChangeColor(change)}`}>
                        {change >= 0 ? '+' : ''}{formatPercent(changePercent)}
                      </span>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{hoveredPrice ? '⏎ Grafik' : currentPeriodLabel}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <BarChart3 className="h-5 w-5" />
                    <p className="text-sm">Hisse yükleniyor...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Price Chart */}
          {selectedStock && (
            <FadeIn delay={0.1}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base hidden sm:block">{selectedStock?.name}</CardTitle>
                    <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide">
                      <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
                        <button
                          onClick={() => setChartType('candle')}
                          className={cn(
                            'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                            chartType === 'candle'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Mum
                        </button>
                        <button
                          onClick={() => setChartType('area')}
                          className={cn(
                            'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                            chartType === 'area'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {'Çizgi'}
                        </button>
                      </div>
                      <div className="flex gap-0.5 sm:gap-1 shrink-0">
                        {([['1D','1G'],['1W','1H'],['1M','1A'],['3M','3A'],['1Y','1Y'],['5Y','5Y']] as [string,string][]).map(([val, label]) => (
                          <Button
                            key={val}
                            variant={period === val ? 'default' : 'ghost'}
                            size="sm"
                            className="text-xs h-7 px-1.5 sm:px-2"
                            onClick={() => setPeriod(val)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px] sm:h-[350px]">
                    <StockChart data={priceHistory} period={period} chartType={chartType} previousClose={selectedStock?.previousClose} currentPrice={selectedStock?.currentPrice} onCrosshairMove={setHoveredPrice} />
                  </div>
                  {(period === '1D' || period === '1W') && (
                    <p className="text-[10px] text-muted-foreground text-right px-4 pb-2">
                      15 dk gecikmeli veri
                    </p>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Stock Details */}
          {selectedStock && (
            <FadeIn delay={0.15}>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Günün En Yükseği</p>
                      <p className="font-mono text-sm font-medium">{formatCurrency(selectedStock?.dayHigh)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Günün En Düşüğü</p>
                      <p className="font-mono text-sm font-medium">{formatCurrency(selectedStock?.dayLow)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Hacim</p>
                      <p className="font-mono text-sm font-medium">{formatNumber(selectedStock?.volume)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Piyasa Değeri</p>
                      <p className="font-mono text-sm font-medium">{formatNumber(selectedStock?.marketCap)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bir Önceki Kapanış</p>
                      <p className="font-mono text-sm font-medium">{formatCurrency(selectedStock?.previousClose)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Borsa</p>
                      <p className="font-mono text-sm font-medium">{selectedStock?.exchange ?? 'BIST'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Sektör</p>
                      <p className="text-sm font-medium">{selectedStock?.sector ?? 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => router.push(`/dashboard/analysis?symbol=${selectedStock.symbol}`)}
                    >
                      <Activity className="h-3.5 w-3.5" /> Teknik Analiz
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => router.push(`/dashboard/auto-trade?symbol=${selectedStock.symbol}`)}
                    >
                      <Bot className="h-3.5 w-3.5" /> Oto Al/Sat Stratejisi Kur
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
          {/* Technical Indicators Panel - prominent for experts */}
          {selectedStock && (
            <FadeIn delay={0.16}>
              <TechnicalPanel symbol={selectedStock.symbol} />
            </FadeIn>
          )}

          {/* Trade Suitability */}
          {selectedStock && (
            <FadeIn delay={0.18}>
              <TradeSuitability symbol={selectedStock.symbol} />
            </FadeIn>
          )}

          {/* Takas Analizi */}
          {selectedStock && (
            <FadeIn delay={0.20}>
              <TakasSection symbol={selectedStock.symbol} isGuest={isGuest} onSignup={() => router.push('/signup')} />
            </FadeIn>
          )}

          {/* Balina Takibi */}
          {selectedStock && (
            <FadeIn delay={0.22}>
              <PremiumGate feature="Balina Radarı">
                <WhaleSection symbol={selectedStock.symbol} isGuest={isGuest} onSignup={() => router.push('/signup')} />
              </PremiumGate>
            </FadeIn>
          )}

          {/* AI Stock Bot - only for registered users */}
          {selectedStock && !isGuest && (
            <FadeIn delay={0.24}>
              <StockBot symbol={selectedStock.symbol} stockName={selectedStock.name} />
            </FadeIn>
          )}

          {/* AI Bot guest block */}
          {selectedStock && isGuest && (
            <FadeIn delay={0.2}>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">AI Hisse Analizi</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                    Yapay zeka destekli hisse analizi için kayıt olun veya giriş yapın
                  </p>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    onClick={() => router.push('/signup')}
                  >
                    Kayıt Ol
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Pending Orders */}
          {(pendingOrders?.length ?? 0) > 0 && (
            <FadeIn delay={0.2}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Bekleyen Emirler
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {pendingOrders.map((order: any) => (
                      <div key={order?.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            order?.type === 'BUY' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                          }`}>
                            {order?.type === 'BUY'
                              ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                              : <TrendingDown className="h-4 w-4 text-red-500" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-semibold text-sm">{order?.stock?.symbol}</p>
                              <Badge variant="outline" className="text-xs">{getOrderTypeLabel(order?.orderType)}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {order?.quantity} adet ·
                              {order?.limitPrice ? ` Limit: ${formatCurrency(order.limitPrice)}` : ''}
                              {order?.stopPrice ? ` Stop: ${formatCurrency(order.stopPrice)}` : ''}
                              {order?.trailingPercent ? ` Takip: %${order.trailingPercent}` : ''}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={() => handleCancelOrder(order?.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </div>

        {/* Trade Panel */}
        <div className="space-y-4">
          {isGuest ? (
            <SlideIn from="right" delay={0.1}>
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Wallet className="w-7 h-7 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">İşlem Yapmak İçin Kayıt Olun</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Alım satım, sermaye yönetimi ve portföy özellikleri kayıtlı kullanıcılara özeldir.
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push('/auth/register')}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    Kayıt Ol
                  </Button>
                </CardContent>
              </Card>
            </SlideIn>
          ) : (
          <>
          <SlideIn from="right" delay={0.1}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Emir Ver</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Market status & delay notice */}
                {!marketOpen && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Borsa kapalı — Emirler açılışta gerçekleştirilecek</span>
                  </div>
                )}
                <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>15 dakika gecikmeli veri</span>
                </div>

                {/* Buy/Sell Toggle */}
                <Tabs value={tradeType} onValueChange={(v: string) => {
                  setTradeType(v as 'BUY' | 'SELL')
                  if (v === 'BUY' && ['STOP_LOSS', 'STOP_LIMIT', 'TRAILING_STOP'].includes(orderType)) setOrderType('MARKET')
                }}>
                  <TabsList className="w-full">
                    <TabsTrigger value="BUY" className="flex-1 gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> Alım
                    </TabsTrigger>
                    <TabsTrigger value="SELL" className="flex-1 gap-1">
                      <TrendingDown className="h-3.5 w-3.5" /> Satım
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Order Type */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">Emir Tipi <InfoTooltip term="Emir Tipi" explanation="Piyasa emri: anında işlem. Limit emri: belirlediğiniz fiyatta. Stop-Loss: zararı sınırlar." /></Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKET">Piyasa Emri</SelectItem>
                      <SelectItem value="LIMIT">Limit Emri</SelectItem>
                      {tradeType === 'SELL' && (
                        <>
                          <SelectItem value="STOP_LOSS">Zarar Durdur (Stop-Loss)</SelectItem>
                          <SelectItem value="STOP_LIMIT">Stop-Limit Emri</SelectItem>
                          <SelectItem value="TRAILING_STOP">Takip Eden Stop</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stock */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-semibold">{selectedStock?.symbol ?? 'Seçin'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{selectedStock?.name}</p>
                    </div>
                    <p className="font-mono font-bold">{formatCurrency(selectedStock?.currentPrice)}</p>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Miktar (adet)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="1"
                    value={quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e?.target?.value ?? '')}
                  />
                </div>

                {/* Limit Price */}
                {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
                  <div className="space-y-2">
                    <Label>Limit Fiyat (₺)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={limitPrice}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLimitPrice(e?.target?.value ?? '')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {tradeType === 'BUY'
                        ? 'Fiyat bu değere veya altına düştüğünde alım yapılır'
                        : 'Fiyat bu değere veya üstüne çıktığında satım yapılır'}
                    </p>
                  </div>
                )}

                {/* Stop Price */}
                {(orderType === 'STOP_LOSS' || orderType === 'STOP_LIMIT') && (
                  <div className="space-y-2">
                    <Label>Stop Fiyat (₺)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={stopPrice}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStopPrice(e?.target?.value ?? '')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {tradeType === 'SELL'
                        ? 'Fiyat bu seviyeye düştüğünde satım tetiklenir'
                        : 'Fiyat bu seviyeye çıktığında alım tetiklenir'}
                    </p>
                  </div>
                )}

                {/* Trailing Percent */}
                {orderType === 'TRAILING_STOP' && (
                  <div className="space-y-2">
                    <Label>Takip Yüzde (%)</Label>
                    <Input
                      type="number"
                      placeholder="5"
                      step="0.5"
                      min="0.5"
                      max="50"
                      value={trailingPercent}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrailingPercent(e?.target?.value ?? '')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Fiyat zirveden %{trailingPercent || '?'} düştüğünde satım tetiklenir
                    </p>
                  </div>
                )}

                {/* Order Summary */}
                {orderType === 'MARKET' && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Birim Fiyat</span>
                      <span className="font-mono">{formatCurrency(selectedStock?.currentPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Miktar</span>
                      <span className="font-mono">{quantity || '0'}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>Toplam</span>
                      <span className="font-mono">{formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                )}

                {orderType !== 'MARKET' && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium">{getOrderTypeLabel(orderType)} Emri</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bu emir koşullar oluştuğunda otomatik olarak gerçekleştirilecektir. Süre: 24 saat.
                    </p>
                  </div>
                )}

                {/* Balance Info */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Mevcut Bakiye</span>
                  <span className="font-mono">{formatCurrency(cashBalance)}</span>
                </div>
                {userHolding && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sahip Olunan</span>
                    <span className="font-mono">{userHolding?.quantity ?? 0} adet</span>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={loading || !selectedStock || !quantity}
                  onClick={handleTrade}
                  variant={tradeType === 'BUY' ? 'default' : 'destructive'}
                >
                  {loading
                    ? 'İşleniyor...'
                    : !marketOpen
                      ? `${tradeType === 'BUY' ? 'Al' : 'Sat'} ${selectedStock?.symbol ?? ''} (Açılışta)`
                      : `${tradeType === 'BUY' ? 'Al' : 'Sat'} ${selectedStock?.symbol ?? ''} (${getOrderTypeLabel(orderType)})`
                  }
                </Button>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Current Holding */}
          {userHolding && (
            <SlideIn from="right" delay={0.15}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pozisyonunuz</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adet</span>
                    <span className="font-mono">{userHolding?.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ort. Alış Fiyatı</span>
                    <span className="font-mono">{formatCurrency(userHolding?.avgBuyPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Güncel Değer</span>
                    <span className="font-mono">{formatCurrency(userHolding?.currentValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kar/Zarar</span>
                    <span className={`font-mono ${getChangeColor(userHolding?.pnl)}`}>
                      {formatCurrency(userHolding?.pnl)} ({formatPercent(userHolding?.pnlPercent)})
                    </span>
                  </div>
                </CardContent>
              </Card>
            </SlideIn>
          )}
          </>
          )}
        </div>
      </div>


    </div>
  )
}
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Activity, TrendingUp, TrendingDown, BarChart3, LineChart, Target,
  ArrowUpDown, AlertTriangle, CheckCircle2, MinusCircle,
} from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/stock-utils'
import { cn } from '@/lib/utils'
import { StockChart } from '@/components/trade/stock-chart'
import { StockBot } from '@/components/trade/stock-bot'
import { TradeSuitability } from '@/components/trade/trade-suitability'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, Area, Cell,
} from 'recharts'

const STRATEGIES = [
  { id: 'SMA_CROSSOVER', name: 'SMA Kesişim', desc: 'SMA(5/10) hızlı kesişim + SMA(20) trend filtresi' },
  { id: 'RSI_STRATEGY', name: 'RSI Kısa Vade', desc: 'RSI(9) + StochRSI(9) · Günlük hızlı sinyal + uyumsuzluk' },
  { id: 'RSI_LONG', name: 'RSI Uzun Vade', desc: 'RSI(14) + StochRSI(14) + SMA(50) trend · Haftalık/swing sinyal' },
  { id: 'MACD_STRATEGY', name: 'Hızlı MACD', desc: 'MACD(5,13,6) histogram + ivme analizi' },
  { id: 'BOLLINGER_STRATEGY', name: 'Bollinger Bantları', desc: 'BB(15,1.8) sıçrama/sıkışma sinyalleri' },
  { id: 'COMBINED', name: 'Günlük Kombine', desc: '7 gösterge birleşik skoru + hacim teyidi' },
]

export function AnalysisContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isGuest } = useUserId()
  const [stocks, setStocks] = useState<any[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [period, setPeriod] = useState('1D')
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['SMA', 'RSI'])
  const [chartType, setChartType] = useState<'candle' | 'area'>('candle')

  useEffect(() => {
    const urlSymbol = searchParams.get('symbol') ?? ''
    fetch('/api/stocks').then(r => r.json()).then(d => {
      setStocks(d ?? [])
      if (urlSymbol && d?.some((s: any) => s.symbol === urlSymbol)) {
        setSelectedSymbol(urlSymbol)
      } else if (d?.length > 0 && !selectedSymbol) {
        setSelectedSymbol(d[0].symbol)
      }
    }).catch(() => {})
  }, [])

  const fetchAnalysis = useCallback(async () => {
    if (!selectedSymbol) return
    setLoading(true)
    try {
      const res = await fetch(`/api/analysis?symbol=${selectedSymbol}&period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setAnalysis(data)
      }
    } catch (err) {
      console.error('Analysis fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedSymbol, period])

  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  // Build chart data with indicators
  const chartDataWithIndicators = useMemo(() => {
    if (!analysis?.history) return []
    return analysis.history.map((h: any, i: number) => {
      const ts = new Date(h.timestamp)
      const entry: any = {
        date: period === '1D'
          ? ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : ts.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume,
      }
      if (analysis.indicators?.sma7) entry.sma7 = analysis.indicators.sma7[i]
      if (analysis.indicators?.sma21) entry.sma21 = analysis.indicators.sma21[i]
      if (analysis.indicators?.sma50) entry.sma50 = analysis.indicators.sma50[i]
      if (analysis.indicators?.ema12) entry.ema12 = analysis.indicators.ema12[i]
      if (analysis.indicators?.ema26) entry.ema26 = analysis.indicators.ema26[i]
      if (analysis.indicators?.rsi) entry.rsi = analysis.indicators.rsi[i]
      if (analysis.indicators?.macd) {
        entry.macd = analysis.indicators.macd.macd[i]
        entry.macdSignal = analysis.indicators.macd.signal[i]
        entry.macdHistogram = analysis.indicators.macd.histogram[i]
      }
      if (analysis.indicators?.bollinger) {
        entry.bbUpper = analysis.indicators.bollinger.upper[i]
        entry.bbMiddle = analysis.indicators.bollinger.middle[i]
        entry.bbLower = analysis.indicators.bollinger.lower[i]
      }
      return entry
    })
  }, [analysis, period])

  const toggleIndicator = (ind: string) => {
    setActiveIndicators(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    )
  }

  const getSignalBadge = (signal: any) => {
    if (!signal) return null
    const color = signal.signal === 'BUY' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
      : signal.signal === 'SELL' ? 'bg-red-500/15 text-red-500 border-red-500/30'
      : 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30'
    const icon = signal.signal === 'BUY' ? <TrendingUp className="h-3 w-3" />
      : signal.signal === 'SELL' ? <TrendingDown className="h-3 w-3" />
      : <MinusCircle className="h-3 w-3" />
    const label = signal.signal === 'BUY' ? 'AL' : signal.signal === 'SELL' ? 'SAT' : 'BEKLE'
    return (
      <Badge variant="outline" className={`${color} gap-1`}>
        {icon} {label} (%{signal.confidence})
      </Badge>
    )
  }

  const prices = chartDataWithIndicators.map((d: any) => d.close).filter(Boolean)
  const minPrice = prices.length > 0 ? Math.min(...prices) * 0.995 : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) * 1.005 : 100

  // Guest restriction
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
          <Activity className="w-10 h-10 text-blue-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Teknik Analiz</h2>
          <p className="text-muted-foreground max-w-md">
            Teknik analiz araçlarını ve strateji testlerini kullanmak için kayıt olmanız gerekmektedir.
          </p>
        </div>
        <Button
          onClick={() => router.push('/signup')}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-3 text-lg"
        >
          Kayıt Ol
        </Button>
        <p className="text-sm text-muted-foreground">
          Zaten hesabınız var mı?{' '}
          <button onClick={() => router.push('/login')} className="text-blue-500 hover:underline">
            Giriş Yap
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Teknik Analiz
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Göstergeler ve sinyallerle hisse analizi</p>
          </div>
        </div>
      </FadeIn>

      {/* Controls */}
      <FadeIn delay={0.05}>
        <div className="flex flex-wrap gap-3">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Hisse seçin" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {(stocks ?? []).map((s: any) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol} - {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {([['1D','1G'],['1W','1H'],['1M','1A'],['3M','3A'],['1Y','1Y']] as [string,string][]).map(([val, label]) => (
              <Button key={val} size="sm" variant={period === val ? 'default' : 'outline'} onClick={() => setPeriod(val)}>
                {label}
              </Button>
            ))}
          </div>

          <div className="flex gap-1 flex-wrap">
            {[{ id: 'SMA', label: 'SMA' }, { id: 'EMA', label: 'EMA' }, { id: 'RSI', label: 'RSI' }, { id: 'MACD', label: 'MACD' }, { id: 'BOLLINGER', label: 'Bollinger' }].map(ind => (
              <Button
                key={ind.id}
                size="sm"
                variant={activeIndicators.includes(ind.id) ? 'default' : 'outline'}
                onClick={() => toggleIndicator(ind.id)}
                className="text-xs"
              >
                {ind.label}
              </Button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Quick Signal Summary */}
      {analysis?.signals && !loading && (
        <FadeIn delay={0.08}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-0 shadow-md">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Activity className="h-3.5 w-3.5" /> RSI (14)
                  <InfoTooltip term="RSI" />
                </div>
                <p className={`font-mono text-xl font-bold ${
                  (analysis?.indicators?.rsi?.slice(-1)[0] ?? 50) > 70 ? 'text-red-500' :
                  (analysis?.indicators?.rsi?.slice(-1)[0] ?? 50) < 30 ? 'text-emerald-500' : 'text-foreground'
                }`}>
                  {analysis?.indicators?.rsi?.slice(-1)[0]?.toFixed(1) ?? '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <BarChart3 className="h-3.5 w-3.5" /> MACD
                  <InfoTooltip term="MACD" />
                </div>
                <p className={`font-mono text-xl font-bold ${
                  (analysis?.indicators?.macd?.histogram?.slice(-1)[0] ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {(analysis?.indicators?.macd?.histogram?.slice(-1)[0] ?? 0) >= 0 ? 'Pozitif' : 'Negatif'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> SMA(20)
                  <InfoTooltip term="SMA" />
                </div>
                {(() => {
                  const sma = analysis?.indicators?.sma50?.slice(-1)[0]
                  const price = analysis?.stock?.currentPrice
                  const above = price && sma ? price > sma : null
                  return (
                    <p className={`font-mono text-xl font-bold ${above === true ? 'text-emerald-500' : above === false ? 'text-red-500' : ''}`}>
                      {above === true ? 'Üzerinde' : above === false ? 'Altında' : '—'}
                    </p>
                  )
                })()}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Target className="h-3.5 w-3.5" /> Bollinger
                  <InfoTooltip term="Bollinger Bantları" />
                </div>
                {(() => {
                  const bb = analysis?.indicators?.bollinger
                  const price = analysis?.stock?.currentPrice
                  if (!bb || !price) return <p className="font-mono text-xl font-bold">{'—'}</p>
                  const upper = bb.upper?.slice(-1)[0]
                  const lower = bb.lower?.slice(-1)[0]
                  const pos = price >= upper ? 'Aşırı Alım' : price <= lower ? 'Aşırı Satım' : 'Normal'
                  const color = price >= upper ? 'text-red-500' : price <= lower ? 'text-emerald-500' : 'text-foreground'
                  return <p className={`font-mono text-xl font-bold ${color}`}>{pos}</p>
                })()}
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      )}

      {/* Price Chart with Indicators */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>{selectedSymbol} - {chartType === 'candle' ? 'Mum' : 'Çizgi'} Grafik</span>
                <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
                  <button
                    onClick={() => setChartType('candle')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
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
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                      chartType === 'area'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Çizgi
                  </button>
                </div>
              </div>
              {analysis?.stock && (
                <span className="font-mono text-lg">{formatCurrency(analysis.stock.currentPrice)}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">Yükleniyor...</div>
            ) : chartDataWithIndicators.length > 0 ? (
              <div className="space-y-0">
                {/* Main chart */}
                <div className="h-[350px]">
                  <StockChart data={analysis?.history ?? []} period={period} chartType={chartType} previousClose={analysis?.stock?.previousClose} currentPrice={analysis?.stock?.currentPrice} />
                </div>

                {/* SMA/EMA/Bollinger overlay chart */}
                {(activeIndicators.includes('SMA') || activeIndicators.includes('EMA') || activeIndicators.includes('BOLLINGER')) && (
                  <div className="h-[200px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartDataWithIndicators} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[minPrice, maxPrice]} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `₺${v?.toFixed?.(0)}`} axisLine={false} width={60} />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                        <Line type="monotone" dataKey="close" stroke="#6b7280" strokeWidth={1.5} dot={false} name="Kapanış" />
                        {activeIndicators.includes('SMA') && (
                          <>
                            <Line type="monotone" dataKey="sma7" stroke="#f59e0b" strokeWidth={1} dot={false} name="SMA(5)" connectNulls />
                            <Line type="monotone" dataKey="sma21" stroke="#3b82f6" strokeWidth={1} dot={false} name="SMA(10)" connectNulls />
                            <Line type="monotone" dataKey="sma50" stroke="#8b5cf6" strokeWidth={1} dot={false} name="SMA(20)" connectNulls />
                          </>
                        )}
                        {activeIndicators.includes('EMA') && (
                          <>
                            <Line type="monotone" dataKey="ema12" stroke="#ec4899" strokeWidth={1} dot={false} name="EMA(9)" connectNulls />
                            <Line type="monotone" dataKey="ema26" stroke="#14b8a6" strokeWidth={1} dot={false} name="EMA(21)" connectNulls />
                          </>
                        )}
                        {activeIndicators.includes('BOLLINGER') && (
                          <>
                            <Line type="monotone" dataKey="bbUpper" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="BB Üst" connectNulls />
                            <Line type="monotone" dataKey="bbMiddle" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 2" dot={false} name="BB Orta" connectNulls />
                            <Line type="monotone" dataKey="bbLower" stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" dot={false} name="BB Alt" connectNulls />
                          </>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* RSI chart */}
                {activeIndicators.includes('RSI') && (
                  <div className="h-[120px] mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 px-1">RSI (14)</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartDataWithIndicators} margin={{ top: 0, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[0, 100]} tickLine={false} tick={{ fontSize: 8 }} axisLine={false} width={30} ticks={[30, 50, 70]} />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                        <Line type="monotone" dataKey="rsi" stroke="#a855f7" strokeWidth={1.5} dot={false} name="RSI" connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* MACD chart */}
                {activeIndicators.includes('MACD') && (
                  <div className="h-[120px] mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 px-1">MACD (12, 26, 9)</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartDataWithIndicators} margin={{ top: 0, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" hide />
                        <YAxis tickLine={false} tick={{ fontSize: 8 }} axisLine={false} width={40} />
                        <ReferenceLine y={0} stroke="#6b7280" strokeOpacity={0.3} />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                        <Bar dataKey="macdHistogram" name="Histogram" isAnimationActive={false}>
                          {chartDataWithIndicators.map((entry: any, idx: number) => (
                            <Cell key={idx} fill={(entry.macdHistogram ?? 0) >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'} />
                          ))}
                        </Bar>
                        <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD" connectNulls />
                        <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" strokeWidth={1} dot={false} name="Sinyal" connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">Veri bulunamadı</div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Multi-Timeframe Signals Panel */}
      {analysis?.multiTimeframe && (
        <FadeIn delay={0.12}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5" /> Çoklu Zaman Dilimi Analizi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {[
                  { key: 'daily', label: 'Günlük', icon: '📊' },
                  { key: 'weekly', label: 'Haftalık', icon: '📅' },
                  { key: 'monthly', label: 'Aylık', icon: '🗓️' },
                ].map(tf => {
                  const data = analysis.multiTimeframe[tf.key]
                  if (!data) return null
                  const sigColor = data.signal === 'AL' ? 'border-emerald-500/40 bg-emerald-500/5'
                    : data.signal === 'SAT' ? 'border-red-500/40 bg-red-500/5'
                    : 'border-yellow-500/40 bg-yellow-500/5'
                  const sigTextColor = data.signal === 'AL' ? 'text-emerald-500'
                    : data.signal === 'SAT' ? 'text-red-500'
                    : 'text-yellow-500'
                  const sigBg = data.signal === 'AL' ? 'bg-emerald-500'
                    : data.signal === 'SAT' ? 'bg-red-500'
                    : 'bg-yellow-500'
                  const trendIcon = data.trend === 'UP' ? '↑' : data.trend === 'DOWN' ? '↓' : '↔'
                  return (
                    <div key={tf.key} className={`p-4 rounded-xl border-2 ${sigColor} transition-all`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm flex items-center gap-1.5">
                          <span>{tf.icon}</span> {tf.label}
                        </span>
                        <Badge variant="outline" className={`${sigTextColor} font-bold text-sm border-current px-3 py-1`}>
                          {data.signal}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Güven</span>
                          <span className="font-mono font-bold">%{data.confidence}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${sigBg}`} style={{ width: `${data.confidence}%` }} />
                        </div>
                        {data.rsi !== null && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">RSI</span>
                            <span className={`font-mono font-bold ${data.rsi <= 30 ? 'text-emerald-500' : data.rsi >= 70 ? 'text-red-500' : ''}`}>
                              {data.rsi}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Trend</span>
                          <span className="font-mono font-bold">{trendIcon} {data.trend === 'UP' ? 'Yukarı' : data.trend === 'DOWN' ? 'Aşağı' : 'Nötr'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(data.reasons ?? []).slice(0, 4).map((r: string, i: number) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/30">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Consensus */}
              <div className={cn(
                'p-4 rounded-xl border-2 text-center',
                analysis.multiTimeframe.consensus === 'AL' ? 'border-emerald-500/40 bg-emerald-500/5' :
                analysis.multiTimeframe.consensus === 'SAT' ? 'border-red-500/40 bg-red-500/5' :
                'border-yellow-500/40 bg-yellow-500/5'
              )}>
                <p className="text-xs text-muted-foreground mb-1">Genel Konsensüs</p>
                <div className="flex items-center justify-center gap-3">
                  <span className={cn(
                    'text-2xl font-bold',
                    analysis.multiTimeframe.consensus === 'AL' ? 'text-emerald-500' :
                    analysis.multiTimeframe.consensus === 'SAT' ? 'text-red-500' : 'text-yellow-500'
                  )}>
                    {analysis.multiTimeframe.consensus}
                  </span>
                  <Badge variant="outline" className={cn(
                    'font-mono text-xs',
                    analysis.multiTimeframe.alignment === 'UYUMLU' ? 'border-emerald-500 text-emerald-500' :
                    analysis.multiTimeframe.alignment === 'ZİT' ? 'border-red-500 text-red-500' :
                    'border-yellow-500 text-yellow-500'
                  )}>
                    {analysis.multiTimeframe.alignment === 'UYUMLU' ? '✓ 3 Dilim Uyumlu' :
                     analysis.multiTimeframe.alignment === 'ZİT' ? '✗ Zıt Sinyaller' : '~ Karma Sinyaller'}
                  </Badge>
                  <span className="text-sm font-mono text-muted-foreground">
                    Skor: {analysis.multiTimeframe.consensusScore > 0 ? '+' : ''}{analysis.multiTimeframe.consensusScore}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Daily Strategy Signals */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5" /> Günlük Strateji Sinyalleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis?.signals ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {STRATEGIES.map(s => {
                  const sig = analysis.signals?.[s.id]
                  return (
                    <div key={s.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{s.name}</span>
                        {getSignalBadge(sig)}
                      </div>
                      <p className="text-xs text-muted-foreground">{sig?.reason ?? s.desc}</p>
                      {sig?.confidence > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                sig.signal === 'BUY' ? 'bg-emerald-500' : sig.signal === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${sig.confidence}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sinyal hesaplanıyor...</p>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Haftalık & Aylık Trade Uygunluğu */}
      {selectedSymbol && (
        <FadeIn delay={0.2}>
          <TradeSuitability symbol={selectedSymbol} />
        </FadeIn>
      )}

      {/* AI Stock Bot */}
      {selectedSymbol && (
        <FadeIn delay={0.35}>
          <StockBot
            symbol={selectedSymbol}
            stockName={stocks.find((s: any) => s.symbol === selectedSymbol)?.name ?? selectedSymbol}
          />
        </FadeIn>
      )}
    </div>
  )
}
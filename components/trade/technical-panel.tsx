'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  Activity, TrendingUp, TrendingDown, BarChart3, Target, ArrowUp, ArrowDown, Minus,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/stock-utils'

interface TechnicalPanelProps {
  symbol: string
}

interface TechnicalData {
  rsi14: number | null
  sma20: number | null
  sma50: number | null
  ema12: number | null
  ema26: number | null
  macd: { macd: number; signal: number; histogram: number } | null
  bollinger: { upper: number; middle: number; lower: number; percentB: number; width: number; squeeze: boolean } | null
  macdCrossover: { crossover: string | null; histogramTrend: string } | null
  support: number[]
  resistance: number[]
  overallSignal: 'AL' | 'SAT' | 'BEKLE'
  signalStrength: number
  confirmingIndicators: number
  totalIndicators: number
  mtf?: {
    daily: { signal: string; confidence: number }
    weekly: { signal: string; confidence: number }
    monthly: { signal: string; confidence: number }
    consensus: string
    consensusScore: number
    alignment: string
  }
}

export function TechnicalPanel({ symbol }: TechnicalPanelProps) {
  const [data, setData] = useState<TechnicalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/analysis?symbol=${symbol}&mode=technical`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error('Technical panel error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 60000) // refresh every 1 min
    return () => clearInterval(interval)
  }, [symbol])

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded-lg" />
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const signalColor = data.overallSignal === 'AL' ? 'text-emerald-500' : data.overallSignal === 'SAT' ? 'text-red-500' : 'text-amber-500'
  const signalBg = data.overallSignal === 'AL' ? 'bg-emerald-500/10' : data.overallSignal === 'SAT' ? 'bg-red-500/10' : 'bg-amber-500/10'
  const signalLabel = data.overallSignal === 'AL' ? 'AL Sinyali' : data.overallSignal === 'SAT' ? 'SAT Sinyali' : 'BEKLE'
  const signalIcon = data.overallSignal === 'AL' ? TrendingUp : data.overallSignal === 'SAT' ? TrendingDown : Minus
  const SignalIcon = signalIcon

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Teknik Göstergeler
            <InfoTooltip term="Teknik Analiz" explanation="Geçmiş fiyat ve hacim verilerini kullanarak gelecekteki fiyat hareketlerini tahmin etmeye çalışan yöntemdir." />
          </CardTitle>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'Gizle' : 'Detay'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Signal */}
        <div className={cn('flex items-center justify-between p-3 rounded-xl', signalBg)}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', signalBg)}>
              <SignalIcon className={cn('h-5 w-5', signalColor)} />
            </div>
            <div>
              <p className={cn('font-bold text-lg', signalColor)}>{signalLabel}</p>
              <p className="text-xs text-muted-foreground">
                {data.confirmingIndicators}/{data.totalIndicators} gösterge onaylamakta
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn('w-2 h-6 rounded-sm', i < data.signalStrength ? (
                  data.overallSignal === 'AL' ? 'bg-emerald-500' : data.overallSignal === 'SAT' ? 'bg-red-500' : 'bg-amber-500'
                ) : 'bg-muted')} />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Güç</p>
          </div>
        </div>

        {/* Key Indicators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* RSI */}
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">RSI(14)</span>
              <InfoTooltip term="RSI" explanation="" />
            </div>
            <p className={cn('font-mono text-lg font-bold', 
              data.rsi14 !== null ? (
                data.rsi14 <= 30 ? 'text-emerald-500' : data.rsi14 >= 70 ? 'text-red-500' : 'text-foreground'
              ) : 'text-muted-foreground'
            )}>
              {data.rsi14 !== null ? data.rsi14.toFixed(1) : '-'}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {data.rsi14 !== null ? (
                data.rsi14 <= 30 ? 'Aşırı Satım → Alım fırsatı' :
                data.rsi14 >= 70 ? 'Aşırı Alım → Dikkat' :
                data.rsi14 <= 40 ? 'Düşük → Alım baskısı' :
                data.rsi14 >= 60 ? 'Yüksek → Satış baskısı' :
                'Nötr bölge'
              ) : 'Veri yok'}
            </p>
          </div>

          {/* MACD */}
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">MACD</span>
              <InfoTooltip term="MACD" explanation="" />
            </div>
            {data.macd ? (
              <>
                <p className={cn('font-mono text-lg font-bold',
                  data.macd.histogram > 0 ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {data.macd.histogram > 0 ? '+' : ''}{data.macd.histogram.toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {data.macdCrossover?.crossover === 'BULLISH' ? '↑ Yukarı Kesim → Alım' :
                   data.macdCrossover?.crossover === 'BEARISH' ? '↓ Aşağı Kesim → Satım' :
                   data.macd.histogram > 0 ? 'Pozitif momentum' : 'Negatif momentum'}
                </p>
              </>
            ) : (
              <p className="font-mono text-lg font-bold text-muted-foreground">-</p>
            )}
          </div>

          {/* Bollinger */}
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">Bollinger</span>
              <InfoTooltip term="Bollinger" explanation="" />
            </div>
            {data.bollinger ? (
              <>
                <p className={cn('font-mono text-lg font-bold',
                  data.bollinger.percentB <= 0.2 ? 'text-emerald-500' :
                  data.bollinger.percentB >= 0.8 ? 'text-red-500' : 'text-foreground'
                )}>
                  %{(data.bollinger.percentB * 100).toFixed(0)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {data.bollinger.squeeze ? '💥 Sıkışma → Büyük hareket beklentisi' :
                   data.bollinger.percentB <= 0.2 ? 'Alt banda yakın → Ucuz' :
                   data.bollinger.percentB >= 0.8 ? 'Üst banda yakın → Pahalı' :
                   'Orta bölgede'}
                </p>
              </>
            ) : (
              <p className="font-mono text-lg font-bold text-muted-foreground">-</p>
            )}
          </div>
        </div>

        {/* Support & Resistance */}
        {(data.support.length > 0 || data.resistance.length > 0) && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ArrowDown className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Destek</span>
                <InfoTooltip term="Destek" explanation="" />
              </div>
              <div className="space-y-1">
                {data.support.slice(0, 3).map((level, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">S{i + 1}</span>
                    <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(level)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ArrowUp className="h-3 w-3 text-red-500" />
                <span className="text-[10px] font-medium text-red-600 dark:text-red-400">Direnç</span>
                <InfoTooltip term="Direnç" explanation="" />
              </div>
              <div className="space-y-1">
                {data.resistance.slice(0, 3).map((level, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">R{i + 1}</span>
                    <span className="font-mono text-xs font-semibold text-red-600 dark:text-red-400">{formatCurrency(level)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Multi-Timeframe Summary */}
        {data.mtf && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-2.5">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Çoklu Zaman Dilimi</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Günlük', data: data.mtf.daily },
                { label: 'Haftalık', data: data.mtf.weekly },
                { label: 'Aylık', data: data.mtf.monthly },
              ].map(tf => {
                const sig = tf.data.signal
                const sigColor = sig === 'AL' ? 'text-emerald-500 bg-emerald-500/10' : sig === 'SAT' ? 'text-red-500 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'
                return (
                  <div key={tf.label} className="text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{tf.label}</p>
                    <div className={cn('inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-sm', sigColor)}>
                      {sig}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">%{tf.data.confidence}</p>
                  </div>
                )
              })}
            </div>
            {data.mtf.alignment && (
              <div className="mt-2 pt-2 border-t border-border/20 text-center">
                <Badge variant="outline" className={cn('text-[10px]',
                  data.mtf.alignment === 'UYUMLU' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  data.mtf.alignment === 'ZİT' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  'bg-amber-500/10 text-amber-500 border-amber-500/20'
                )}>
                  {data.mtf.alignment === 'UYUMLU' ? '✓ Tüm zaman dilimleri uyumlu' :
                   data.mtf.alignment === 'ZİT' ? '✗ Zaman dilimleri çelişkili' :
                   '↔ Karma sinyaller'}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Expanded Detail: SMA/EMA values */}
        {expanded && (
          <div className="space-y-2.5 pt-2 border-t border-border/20">
            <p className="text-xs font-medium text-muted-foreground">Hareketli Ortalamalar</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'SMA(20)', value: data.sma20, term: 'SMA' },
                { label: 'SMA(50)', value: data.sma50, term: 'SMA' },
                { label: 'EMA(12)', value: data.ema12, term: 'EMA' },
                { label: 'EMA(26)', value: data.ema26, term: 'EMA' },
              ].map(ma => (
                <div key={ma.label} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    {ma.label} <InfoTooltip term={ma.term} explanation="" />
                  </span>
                  <span className="font-mono text-xs font-medium">
                    {ma.value !== null ? formatCurrency(ma.value) : '-'}
                  </span>
                </div>
              ))}
            </div>

            {data.bollinger && (
              <>
                <p className="text-xs font-medium text-muted-foreground">Bollinger Bantları</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded bg-muted/30 text-center">
                    <span className="text-[9px] text-muted-foreground">Üst</span>
                    <p className="font-mono text-xs font-medium text-red-400">{formatCurrency(data.bollinger.upper)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30 text-center">
                    <span className="text-[9px] text-muted-foreground">Orta</span>
                    <p className="font-mono text-xs font-medium">{formatCurrency(data.bollinger.middle)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30 text-center">
                    <span className="text-[9px] text-muted-foreground">Alt</span>
                    <p className="font-mono text-xs font-medium text-emerald-400">{formatCurrency(data.bollinger.lower)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

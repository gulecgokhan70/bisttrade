'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Fish, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, BarChart3, Clock, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, ReferenceDot,
} from 'recharts'

interface WhaleEvent {
  date: string
  type: 'ENTRY' | 'EXIT'
  strength: number
  price: number
  volume: number
  volumeRatio: number
  description: string
}

type WhaleMode = 'daily' | 'intraday'

interface WhaleData {
  symbol: string
  stockName: string
  mode?: WhaleMode
  whaleScore: { score: number; level: string; trend: string }
  events: WhaleEvent[]
  recentActivity: string
  avgVolume20: number
  currentVolume: number
  volumeRatio: number
  accumulationDays: number
  distributionDays: number
  netWhaleFlow: number
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'YÜKSEK': { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'ORTA': { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  'DÜŞÜK': { color: 'text-zinc-400', bg: 'bg-zinc-500/15', border: 'border-zinc-500/30' },
}

const TREND_LABEL: Record<string, string> = {
  'ARTIYOR': '↑ Artıyor',
  'AZALIYOR': '↓ Azalıyor',
  'STABIL': '↔ Stabil',
}

function formatVol(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return v.toFixed(0)
}

interface WhaleSectionProps {
  symbol: string
  isGuest: boolean
  onSignup: () => void
}

export function WhaleSection({ symbol, isGuest, onSignup }: WhaleSectionProps) {
  const [data, setData] = useState<WhaleData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showChart, setShowChart] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [mode, setMode] = useState<WhaleMode>('daily')

  const fetchData = useCallback(async (m?: WhaleMode) => {
    if (!symbol) return
    const targetMode = m ?? mode
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/whale?period=${targetMode}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Hata')
      setData(json)
    } catch (e: any) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [symbol, mode])

  useEffect(() => {
    if (!isGuest) fetchData()
  }, [fetchData, isGuest])

  const handleModeChange = (newMode: WhaleMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setShowEvents(false)
    fetchData(newMode)
  }

  if (isGuest) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-base mb-1">Balina Takibi</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            Balina giriş/çıkış takibi için kayıt olun
          </p>
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={onSignup}>
            Kayıt Ol
          </Button>
        </CardContent>
      </Card>
    )
  }

  const scoreConfig = data ? (LEVEL_CONFIG[data.whaleScore.level] || LEVEL_CONFIG['DÜŞÜK']) : LEVEL_CONFIG['DÜŞÜK']

  // Build chart data from events mapped to dates
  const recentEvents = data?.events?.slice(-20) ?? []
  const entryEvents = recentEvents.filter(e => e.type === 'ENTRY')
  const exitEvents = recentEvents.filter(e => e.type === 'EXIT')

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fish className="h-4 w-4 text-cyan-400" />
            Balina Takibi
          </CardTitle>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => handleModeChange('daily')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                mode === 'daily' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarDays className="h-3 w-3" />
              Günlük
            </button>
            <button
              onClick={() => handleModeChange('intraday')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                mode === 'intraday' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Clock className="h-3 w-3" />
              Gün İçi
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Analiz ediliyor...</span>
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center py-4">{error}</p>}

        {data && !loading && (
          <div className="space-y-3">
            {/* Score + Summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border', scoreConfig.bg, scoreConfig.border)}>
                <Fish className={cn('h-4 w-4', scoreConfig.color)} />
                <span className={cn('text-lg font-bold font-mono', scoreConfig.color)}>{data.whaleScore.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <div>
                <Badge variant="outline" className={cn('text-xs', scoreConfig.bg, scoreConfig.color, scoreConfig.border)}>
                  {data.whaleScore.level}
                </Badge>
              </div>
              <Badge variant="outline" className="text-xs">
                {TREND_LABEL[data.whaleScore.trend] || data.whaleScore.trend}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">{data.recentActivity}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">Net Akış</p>
                <p className={cn('text-sm font-bold font-mono', data.netWhaleFlow > 0 ? 'text-emerald-400' : data.netWhaleFlow < 0 ? 'text-red-400' : '')}>
                  {data.netWhaleFlow > 0 ? '+' : ''}{data.netWhaleFlow}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">{mode === 'intraday' ? 'Birikim Mum' : 'Birikim Gün'}</p>
                <p className="text-sm font-bold text-emerald-400 font-mono">{data.accumulationDays}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">{mode === 'intraday' ? 'Dağıtım Mum' : 'Dağıtım Gün'}</p>
                <p className="text-sm font-bold text-red-400 font-mono">{data.distributionDays}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">Hacim</p>
                <p className="text-xs font-mono font-semibold">{formatVol(data.currentVolume)}</p>
                <p className={cn('text-[10px] font-mono', data.volumeRatio > 1.5 ? 'text-emerald-400' : data.volumeRatio < 0.8 ? 'text-red-400' : 'text-muted-foreground')}>
                  {data.volumeRatio}x ort
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">Olaylar</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-mono">
                    <span className="text-emerald-400">{entryEvents.length}</span>
                    <span className="text-muted-foreground"> giriş</span>
                  </span>
                  <span className="text-xs font-mono">
                    <span className="text-red-400">{exitEvents.length}</span>
                    <span className="text-muted-foreground"> çıkış</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Event Timeline */}
            {!showEvents && data.events.length > 0 ? (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowEvents(true)}>
                Balina Olayları ({data.events.length})
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            ) : data.events.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Son Balina Olayları</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {[...data.events].reverse().slice(0, 15).map((evt, i) => (
                    <div key={i} className={cn(
                      'flex items-center gap-2 p-2 rounded-lg text-xs',
                      evt.type === 'ENTRY' ? 'bg-emerald-500/5' : 'bg-red-500/5'
                    )}>
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                        evt.type === 'ENTRY' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                      )}>
                        {evt.type === 'ENTRY' ?
                          <ArrowUpRight className="h-3 w-3 text-emerald-400" /> :
                          <ArrowDownRight className="h-3 w-3 text-red-400" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-muted-foreground">{mode === 'intraday' ? evt.date.slice(11) : evt.date.slice(5)}</span>
                          <Badge variant="outline" className={cn(
                            'text-[9px] px-1 py-0',
                            evt.type === 'ENTRY' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'
                          )}>
                            {evt.type === 'ENTRY' ? 'Giriş' : 'Çıkış'}
                          </Badge>
                          <span className="font-mono text-muted-foreground">{evt.volumeRatio}x</span>
                          <span className="font-mono text-foreground/70">%{evt.strength}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{evt.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowEvents(false)}>
                  Gizle <ChevronUp className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ) : null}

            <p className="text-[10px] text-yellow-500/60 text-center">
              ⚠️ {mode === 'intraday' ? '5dk mumlarından' : 'Hacim paternlerinden'} üretilen tahmindir · Yatırım tavsiyesi değildir
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

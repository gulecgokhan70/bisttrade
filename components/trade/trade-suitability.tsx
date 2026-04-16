'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Clock, Calendar, CalendarDays, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuitabilityData {
  rating: 'UYGUN' | 'RISKLI' | 'NOTR'
  score: number
  reasons: string[]
}

interface Props {
  symbol: string
}

const ratingConfig = {
  UYGUN: {
    label: 'Uygun',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  RISKLI: {
    label: 'Riskli',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  },
  NOTR: {
    label: 'Nötr',
    icon: MinusCircle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  },
}

function ScoreBar({ score }: { score: number }) {
  // score is -100 to 100, map to 0-100 for display
  const pct = Math.round((score + 100) / 2)
  const color = score >= 15 ? 'bg-emerald-500' : score <= -10 ? 'bg-red-500' : 'bg-yellow-500'
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.max(5, pct)}%` }}
      />
    </div>
  )
}

function RatingCard({
  title,
  icon: Icon,
  data,
  loading,
}: {
  title: string
  icon: React.ElementType
  data: SuitabilityData | null
  loading: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (loading) {
    return (
      <div className="p-3 rounded-xl bg-muted/50 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded bg-muted" />
          <div className="w-24 h-4 rounded bg-muted" />
        </div>
        <div className="w-16 h-5 rounded bg-muted" />
      </div>
    )
  }

  if (!data) return null

  const config = ratingConfig[data.rating]
  const RatingIcon = config.icon

  return (
    <div className={cn('rounded-xl border p-3 transition-colors', config.bg, config.border)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className={cn('text-xs font-semibold gap-1', config.badge)}>
          <RatingIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      <ScoreBar score={data.score} />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground">Skor: {data.score > 0 ? '+' : ''}{data.score}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          {expanded ? 'Gizle' : 'Detaylar'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {expanded && data.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-2">
          {data.reasons.map((r, i) => (
            <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TradeSuitability({ symbol }: Props) {
  const [data, setData] = useState<{ daily: SuitabilityData; weekly: SuitabilityData; monthly: SuitabilityData } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)
    setData(null)
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/suitability`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!cancelled && json) setData({ daily: json.daily, weekly: json.weekly, monthly: json.monthly })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Trade Uygunluğu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <RatingCard
          title="Günlük Trade"
          icon={Clock}
          data={data?.daily ?? null}
          loading={loading}
        />
        <RatingCard
          title="Haftalık Trade"
          icon={Calendar}
          data={data?.weekly ?? null}
          loading={loading}
        />
        <RatingCard
          title="Aylık Trade"
          icon={CalendarDays}
          data={data?.monthly ?? null}
          loading={loading}
        />
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          Teknik analiz göstergeleri (RSI, SMA, MACD, Bollinger) baz alınmıştır. Yatırım tavsiyesi değildir.
        </p>
      </CardContent>
    </Card>
  )
}

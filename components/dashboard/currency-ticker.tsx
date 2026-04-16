'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

interface ForexRate {
  pair: string
  label: string
  rate: number
  change: number
  changePercent: number
  unit?: string
}

interface HistoryPoint {
  date: string
  close: number
}

const PERIODS = [
  { key: '1D', label: 'Gün' },
  { key: '1M', label: 'Ay' },
  { key: '1Y', label: 'Yıl' },
]

export function CurrencyTicker() {
  const [rates, setRates] = useState<ForexRate[]>([])
  const [mounted, setMounted] = useState(false)
  const [selectedPair, setSelectedPair] = useState<ForexRate | null>(null)
  const [chartData, setChartData] = useState<HistoryPoint[]>([])
  const [chartPeriod, setChartPeriod] = useState('1D')
  const [chartLoading, setChartLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)

  useEffect(() => {
    setMounted(true)
    fetchRates()
    const interval = setInterval(fetchRates, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Touch/mouse drag handlers for manual scroll
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true)
    dragStartX.current = clientX
    const container = scrollRef.current?.parentElement
    if (container) {
      scrollStartX.current = container.scrollLeft
    }
  }, [])

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return
    const container = scrollRef.current?.parentElement
    if (container) {
      const diff = dragStartX.current - clientX
      container.scrollLeft = scrollStartX.current + diff
    }
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const fetchRates = async () => {
    try {
      const res = await fetch('/api/forex')
      if (res.ok) {
        const data = await res.json()
        if (data?.length > 0) setRates(data)
      }
    } catch {}
  }

  const fetchChart = useCallback(async (pair: string, period: string) => {
    setChartLoading(true)
    try {
      const res = await fetch(`/api/forex/history?pair=${encodeURIComponent(pair)}&period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setChartData(data?.history ?? [])
      }
    } catch {}
    setChartLoading(false)
  }, [])

  const openChart = (rate: ForexRate) => {
    setSelectedPair(rate)
    setChartPeriod('1D')
    fetchChart(rate.pair, '1D')
  }

  const closeChart = () => {
    setSelectedPair(null)
    setChartData([])
  }

  const changePeriod = (period: string) => {
    setChartPeriod(period)
    if (selectedPair) fetchChart(selectedPair.pair, period)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPair) closeChart()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedPair])

  if (!mounted || rates.length === 0) return null

  // Duplicate rates array for seamless infinite scroll
  const duplicatedRates = [...rates, ...rates]

  const formatRate = (rate: number, pair: string) => {
    if (pair === 'GRAM_ALTIN' || pair === 'CEYREK_ALTIN') {
      return `₺${rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (pair === 'XU100.IS') return rate.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
    return rate.toFixed(4)
  }

  const formatChartValue = (val: number) => {
    if (!selectedPair) return val.toString()
    if (selectedPair.pair === 'GRAM_ALTIN' || selectedPair.pair === 'CEYREK_ALTIN') {
      return `₺${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (selectedPair.pair === 'XU100.IS') return val.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
    return val.toFixed(4)
  }

  const formatChartTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (chartPeriod === '1D') {
        return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
      }
      if (chartPeriod === '1M') {
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' })
      }
      return d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit', timeZone: 'Europe/Istanbul' })
    } catch { return '' }
  }

  const chartColor = selectedPair && selectedPair.change >= 0 ? '#10b981' : '#ef4444'

  // Portal modal to escape header's backdrop-filter containing block
  const chartModal = selectedPair ? createPortal(
    // @ts-ignore - React 18 createPortal type mismatch
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" onClick={closeChart}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: 'min(520px, 90vh)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{selectedPair.label}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-mono font-bold">
                {formatRate(selectedPair.rate, selectedPair.pair)}
              </span>
              <span className={`flex items-center gap-0.5 text-[11px] font-mono font-medium ${
                selectedPair.change >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {selectedPair.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {selectedPair.change >= 0 ? '+' : ''}{selectedPair.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <button onClick={closeChart} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0" aria-label="Kapat">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 pb-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => changePeriod(p.key)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                chartPeriod === p.key ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >{p.label}</button>
          ))}
        </div>
        <div className="px-3 pb-2 h-[240px] sm:h-[260px]">
          {chartLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Grafik verisi bulunamadı</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="forexGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => formatChartValue(v)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.[0]) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-card border rounded-lg shadow-lg p-2 text-xs">
                      <p className="font-medium mb-0.5">{new Date(d.date).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
                      <p className="font-mono font-bold text-sm">{formatChartValue(d.close)}</p>
                    </div>
                  )
                }} />
                <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={2} fill="url(#forexGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="px-4 pb-3">
          <button onClick={closeChart} className="w-full py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">Kapat</button>
        </div>
      </div>
    </div>,
    document.body
  ) as unknown as React.ReactElement : null

  return (
    <>
      <div
        className="w-full bg-muted/20 border-b border-border/30 overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        onMouseDown={(e) => { e.preventDefault(); handleDragStart(e.clientX) }}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
      >
        <div
          ref={scrollRef}
          className={`flex items-center py-1 sm:py-1.5 w-max ${isDragging ? '' : 'ticker-scroll'}`}
        >
          {duplicatedRates.map((r, idx) => {
            const isUp = r.change >= 0
            return (
              <button
                key={`${r.pair}-${idx}`}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md hover:bg-muted/80 transition-colors whitespace-nowrap shrink-0 group"
                onClick={() => { if (!isDragging) openChart(r) }}
              >
                <span className="text-xs font-semibold text-foreground">{r.label}</span>
                <span className="text-xs font-mono font-medium text-foreground/80">
                  {formatRate(r.rate, r.pair)}
                </span>
                <span className={`flex items-center gap-0.5 text-[10px] font-mono font-medium ${
                  isUp ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {isUp ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {isUp ? '+' : ''}{r.changePercent.toFixed(2)}%
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {chartModal}
    </>
  )
}
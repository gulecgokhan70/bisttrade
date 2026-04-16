'use client'

import { useId, useMemo, useRef, useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  Area,
  AreaChart,
  Customized,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/stock-utils'

interface StockChartProps {
  data: any[]
  period: string
  chartType?: 'candle' | 'area'
  indicators?: { sma?: number[]; ema?: number[]; bollinger?: boolean }
  previousClose?: number
  currentPrice?: number
  onCrosshairMove?: (price: number | null) => void
}

// Candlestick renderer using Customized component for reliable scale access
const CandlestickRenderer = (props: any) => {
  const { formattedGraphicalItems, xAxisMap, yAxisMap } = props
  if (!xAxisMap || !yAxisMap) return null

  const xAxis = Object.values(xAxisMap)[0] as any
  const yAxis = Object.values(yAxisMap)[0] as any
  if (!xAxis?.scale || !yAxis?.scale) return null

  const barItem = formattedGraphicalItems?.[0]
  if (!barItem?.props?.data) return null

  const items = barItem.props.data
  const bandWidth = xAxis.bandSize || (xAxis.width / items.length)

  return (
    <g>
      {items.map((item: any, idx: number) => {
        const entry = item?.payload
        if (!entry) return null
        const { open, close, high, low } = entry
        if (open == null || close == null || high == null || low == null) return null

        const isUp = close >= open
        const color = isUp ? '#10b981' : '#ef4444'

        const xPos = item.x ?? (xAxis.scale(idx) + (bandWidth / 2))
        const xCenter = typeof xPos === 'number' ? xPos : 0
        const bodyWidth = Math.max(bandWidth * 0.6, 3)

        const yHigh = yAxis.scale(high)
        const yLow = yAxis.scale(low)
        const yOpen = yAxis.scale(open)
        const yClose = yAxis.scale(close)
        const bodyTop = Math.min(yOpen, yClose)
        const bodyBottom = Math.max(yOpen, yClose)
        const bodyH = Math.max(bodyBottom - bodyTop, 1)

        return (
          <g key={idx}>
            <line x1={xCenter} y1={yHigh} x2={xCenter} y2={bodyTop} stroke={color} strokeWidth={1} />
            <line x1={xCenter} y1={bodyBottom} x2={xCenter} y2={yLow} stroke={color} strokeWidth={1} />
            <rect
              x={xCenter - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={bodyH}
              fill={color}
              stroke={color}
              strokeWidth={0.5}
              rx={1}
            />
          </g>
        )
      })}
    </g>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0]?.payload
  if (!d) return null
  const isUp = (d.close ?? 0) >= (d.open ?? 0)
  return (
    <div className="bg-background/95 backdrop-blur border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1">{d.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">Açılış:</span>
        <span className="text-right font-mono">{formatCurrency(d.open)}</span>
        <span className="text-muted-foreground">Yüksek:</span>
        <span className="text-right font-mono text-emerald-500">{formatCurrency(d.high)}</span>
        <span className="text-muted-foreground">Düşük:</span>
        <span className="text-right font-mono text-red-500">{formatCurrency(d.low)}</span>
        <span className="text-muted-foreground">Kapanış:</span>
        <span className={`text-right font-mono ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(d.close)}</span>
        <span className="text-muted-foreground">Hacim:</span>
        <span className="text-right font-mono">{((d.volume ?? 0) / 1000000).toFixed(1)}M</span>
      </div>
    </div>
  )
}

export function StockChart({ data, period, chartType = 'candle', indicators, previousClose, currentPrice, onCrosshairMove }: StockChartProps) {
  const chartId = useId().replace(/:/g, '')
  const gradGreenId = `gradGreen-${chartId}`
  const gradRedId = `gradRed-${chartId}`

  // Track if this is the first render - only animate on first load
  const isFirstRender = useRef(true)
  const crosshairTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKnownPrice = useRef<number | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(true)
  const [animateChart, setAnimateChart] = useState(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      // Disable animation after first render completes
      const timer = setTimeout(() => setAnimateChart(false), 600)
      return () => clearTimeout(timer)
    }
  }, [])

  // Reset animation when period changes (user action)
  const prevPeriod = useRef(period)
  useEffect(() => {
    if (prevPeriod.current !== period) {
      prevPeriod.current = period
      setAnimateChart(true)
      const timer = setTimeout(() => setAnimateChart(false), 600)
      return () => clearTimeout(timer)
    }
  }, [period])

  const chartData = useMemo(() => {
    if (!data || (data?.length ?? 0) === 0) return []
    const mapped = (data ?? []).map((d: any) => {
      const ts = d?.timestamp ? new Date(d.timestamp) : new Date()
      let dateLabel = ''
      if (period === '1D') {
        dateLabel = ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
      } else if (period === '1W') {
        dateLabel = ts.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' }) + ' ' +
          ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
      } else if (period === '5Y') {
        dateLabel = ts.toLocaleDateString('tr-TR', { year: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' })
      } else {
        dateLabel = ts.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', timeZone: 'Europe/Istanbul' })
      }
      return {
        ts: ts.getTime(),
        date: dateLabel,
        open: d?.open ?? d?.price ?? 0,
        high: d?.high ?? d?.price ?? 0,
        low: d?.low ?? d?.price ?? 0,
        close: d?.close ?? d?.price ?? 0,
        price: d?.close ?? d?.price ?? 0,
        volume: d?.volume ?? 0,
      }
    })
    // Align chart's last point with live currentPrice for intraday periods
    if (currentPrice && currentPrice > 0 && mapped.length > 0 && (period === '1D' || period === '1W')) {
      const last = mapped[mapped.length - 1]
      mapped[mapped.length - 1] = {
        ...last,
        close: currentPrice,
        price: currentPrice,
        high: Math.max(last.high, currentPrice),
        low: Math.min(last.low, currentPrice),
      }
    }
    // For 1D: prepend a point at previousClose so the line starts from yesterday's close
    if (period === '1D' && previousClose && previousClose > 0 && mapped.length > 0) {
      const firstTs = mapped[0].ts
      mapped.unshift({
        ts: firstTs - 1,
        date: '',
        open: previousClose,
        high: previousClose,
        low: previousClose,
        close: previousClose,
        price: previousClose,
        volume: 0,
      })
    }
    return mapped
  }, [data, period, currentPrice, previousClose])

  // Reference price: previousClose for 1D, first data point for longer periods
  const refPrice = useMemo(() => {
    if (period === '1D' && previousClose && previousClose > 0) return previousClose
    if (chartData.length === 0) return 0
    return chartData[0]?.close ?? 0
  }, [chartData, previousClose, period])

  if ((chartData?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Grafik verisi yok
      </div>
    )
  }

  const prices = chartData.flatMap((d: any) => [d.high, d.low]).filter((v: any) => v > 0)
  const allPrices = refPrice > 0 ? [...prices, refPrice] : prices
  const minPrice = Math.min(...allPrices) * 0.997
  const maxPrice = Math.max(...allPrices) * 1.003
  const maxVolume = Math.max(...chartData.map((d: any) => d.volume ?? 0))
  const lastClose = chartData[chartData.length - 1]?.close ?? 0
  // Compare last price against refPrice (previousClose or period start)
  const isPositive = lastClose >= refPrice

  // Pulsing dot - only renders on the last data point
  const lastDataIndex = chartData.length - 1
  const renderPulsingDot = (dotProps: any) => {
    if (dotProps.index !== lastDataIndex) return null
    const { cx, cy } = dotProps
    if (typeof cx !== 'number' || typeof cy !== 'number' || isNaN(cx) || isNaN(cy)) return null
    const dotColor = isPositive ? '#10b981' : '#ef4444'
    return (
      <g key="pulse-dot">
        <circle cx={cx} cy={cy} r={6} fill={dotColor} opacity={0.2}>
          <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.05;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={3.5} fill={dotColor} stroke="white" strokeWidth={1.5} />
      </g>
    )
  }

  const handleMouseMove = (state: any) => {
    const d = state?.activePayload?.[0]?.payload
    const price = d ? (d.close ?? d.price ?? null) : null
    if (price && price > 0) {
      // Finger/mouse is on chart — show tooltip + price, cancel dismiss timer
      if (crosshairTimer.current) clearTimeout(crosshairTimer.current)
      lastKnownPrice.current = price
      setTooltipVisible(true)
      if (onCrosshairMove) onCrosshairMove(price)
    }
  }
  const handleTouchEnd = () => {
    // Start 4-second countdown to dismiss tooltip + price after finger lifts
    if (crosshairTimer.current) clearTimeout(crosshairTimer.current)
    crosshairTimer.current = setTimeout(() => {
      setTooltipVisible(false)
      if (onCrosshairMove) onCrosshairMove(null)
      lastKnownPrice.current = null
    }, 4000)
  }
  const handleMouseLeave = () => {
    // Desktop: same 4-second delay
    if (crosshairTimer.current) clearTimeout(crosshairTimer.current)
    crosshairTimer.current = setTimeout(() => {
      setTooltipVisible(false)
      if (onCrosshairMove) onCrosshairMove(null)
      lastKnownPrice.current = null
    }, 4000)
  }

  // Single color: green if above previous close, red if below
  const lineColor = isPositive ? '#10b981' : '#ef4444'
  const fillGradId = isPositive ? gradGreenId : gradRedId

  if (chartType === 'area') {
    return (
      <div style={{ width: '100%', height: '100%' }} onTouchEnd={handleTouchEnd}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs>
            <linearGradient id={gradGreenId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={gradRedId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis
            domain={[minPrice, maxPrice]}
            tickLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `₺${v?.toFixed?.(0)}`}
            axisLine={false}
            width={60}
          />
          <Tooltip content={tooltipVisible ? <CustomTooltip /> : <></>} />
          {/* Single fill area from refPrice (previous close) to price line */}
          <Area
            type="monotone"
            dataKey="close"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${fillGradId})`}
            fillOpacity={1}
            dot={renderPulsingDot as any}
            isAnimationActive={animateChart}
            animationDuration={500}
            animationEasing="ease-out"
            baseValue={refPrice}
          />
          {/* Previous close reference line (dashed) */}
          {refPrice > 0 && (
            <ReferenceLine
              y={refPrice}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      </div>
    )
  }

  // Candlestick chart with volume
  return (
    <div className="w-full h-full flex flex-col" onTouchEnd={handleTouchEnd}>
      {/* Price candlestick */}
      <div className="flex-1 min-h-0" style={{ height: '75%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="date" hide />
            <YAxis
              domain={[minPrice, maxPrice]}
              tickLine={false}
              tick={{ fontSize: 9 }}
              tickFormatter={(v: number) => `₺${v?.toFixed?.(0)}`}
              axisLine={false}
              width={60}
            />
            <Tooltip content={tooltipVisible ? <CustomTooltip /> : <></>} />
            {/* Min price reference line */}
            {refPrice > 0 && (
              <ReferenceLine
                y={refPrice}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.35}
              />
            )}
            <Bar dataKey="high" fill="transparent" isAnimationActive={false} />
            <Customized component={CandlestickRenderer} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Volume bars */}
      <div style={{ height: '25%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 0, right: 5, left: 0, bottom: 5 }}>
            <XAxis dataKey="date" hide />
            <YAxis
              domain={[0, maxVolume * 1.2]}
              tickLine={false}
              tick={{ fontSize: 8 }}
              tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
              axisLine={false}
              width={60}
              yAxisId="vol"
            />
            {tooltipVisible && <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              formatter={(value: any) => [`${((Number(value) ?? 0) / 1000000).toFixed(2)}M`, 'Hacim']}
            />}
            <Bar dataKey="volume" yAxisId="vol" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {chartData.map((entry: any, idx: number) => (
                <Cell
                  key={idx}
                  fill={(entry.close ?? 0) >= (entry.open ?? 0) ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
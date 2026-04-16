'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity, BarChart3, Building2, Percent, Waves, ArrowUpDown, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area, Line, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Cell,
} from 'recharts'

interface TakasData {
  symbol: string
  stockName: string
  period: string
  flowData: Array<{
    date: string
    price: number
    volume: number
    adLine: number
    obv: number
    mfi: number | null
    cmf: number | null
    institutionalFlow: number
    retailFlow: number
    blockTradeRatio: number
  }>
  summary: {
    adTrend: string
    obvTrend: string
    mfiSignal: string
    cmfSignal: string
    institutionalBias: string
    overallSignal: string
    confidence: number
    description: string
  }
  latestMFI: number | null
  latestCMF: number | null
  adChange5d: number
  obvChange5d: number
  avgVolume20: number
  currentVolume: number
  volumeRatio: number
}

const SIGNAL_CONFIG: Record<string, { color: string; label: string }> = {
  'BİRİKİM': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: '↑ Birikim' },
  'DAĞITIM': { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: '↓ Dağıtım' },
  'BELİRSİZ': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: '↔ Belirsiz' },
  'NÖTR': { color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', label: '• Nötr' },
  'AŞIRI_ALIM': { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Aşırı Alım' },
  'AŞIRI_SATIM': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Aşırı Satım' },
  'PARA_GİRİŞİ': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: '↑ Para Girişi' },
  'PARA_ÇIKIŞI': { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: '↓ Para Çıkışı' },
  'ALIM': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: '↑ Alım' },
  'SATIM': { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: '↓ Satım' },
  'YUKARI': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: '↑ Yukarı' },
  'AŞAĞI': { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: '↓ Aşağı' },
  'YATAY': { color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', label: '↔ Yatay' },
}

function SignalBadge({ signal }: { signal: string }) {
  const c = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG['NÖTR']
  return (
    <Badge variant="outline" className={cn(c.color, 'border text-xs')}>
      {c.label}
    </Badge>
  )
}

function formatVol(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return v.toFixed(0)
}

interface TakasSectionProps {
  symbol: string
  isGuest: boolean
  onSignup: () => void
}

export function TakasSection({ symbol, isGuest, onSignup }: TakasSectionProps) {
  const [data, setData] = useState<TakasData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('1G')
  const [expanded, setExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/takas-analysis?symbol=${symbol}&period=${period}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Hata')
      setData(json)
    } catch (e: any) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [symbol, period])

  useEffect(() => {
    if (!isGuest) fetchData()
  }, [fetchData, isGuest])

  // Guest block
  if (isGuest) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-base mb-1">Takas Analizi</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            Birikim/dağıtım analizi ve kurumsal akış tahmini için kayıt olun
          </p>
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            onClick={onSignup}
          >
            Kayıt Ol
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Slice chart data based on period
  const chartSlice = period === '1G' ? 3 : period === '1H' ? 7 : period === '1M' ? 22 : 60
  const chartData = data?.flowData?.slice(-chartSlice).map(d => ({
    ...d,
    date: d.date.slice(5),
    mfi: d.mfi ?? 50,
    cmf: d.cmf !== null ? +(d.cmf * 100).toFixed(1) : 0,
    adNorm: d.adLine,
    obvNorm: d.obv,
  })) || []

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            Takas Analizi
          </CardTitle>
          <div className="flex gap-0.5">
            {[['1G','1G'],['1H','1H'],['1M','1A'],['3M','3A'],['1Y','1Y']].map(([val, label]) => (
              <Button
                key={val}
                variant={period === val ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-6 px-1.5"
                onClick={() => setPeriod(val)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Hesaplanıyor...</span>
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center py-4">{error}</p>}

        {data && !loading && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  'text-sm px-3 py-1 border',
                  data.summary.overallSignal === 'BİRİKİM' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  data.summary.overallSignal === 'DAĞITIM' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                )}
              >
                {data.summary.overallSignal === 'BİRİKİM' ? '↑ Birikim' :
                 data.summary.overallSignal === 'DAĞITIM' ? '↓ Dağıtım' : '↔ Belirsiz'}
              </Badge>
              <Badge variant="outline" className="text-xs">Güven: %{data.summary.confidence}</Badge>
              <span className="text-xs text-muted-foreground">{data.summary.description}</span>
            </div>

            {/* Indicator Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">A/D</p>
                <SignalBadge signal={data.summary.adTrend} />
                <p className="text-[10px] mt-0.5 font-mono">
                  <span className={data.adChange5d > 0 ? 'text-emerald-400' : data.adChange5d < 0 ? 'text-red-400' : ''}>
                    {data.adChange5d > 0 ? '+' : ''}{data.adChange5d.toFixed(1)}%
                  </span>
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">OBV</p>
                <SignalBadge signal={data.summary.obvTrend} />
                <p className="text-[10px] mt-0.5 font-mono">
                  <span className={data.obvChange5d > 0 ? 'text-emerald-400' : data.obvChange5d < 0 ? 'text-red-400' : ''}>
                    {data.obvChange5d > 0 ? '+' : ''}{data.obvChange5d.toFixed(1)}%
                  </span>
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">MFI</p>
                <SignalBadge signal={data.summary.mfiSignal} />
                <p className="text-[10px] mt-0.5 font-mono">{data.latestMFI !== null ? data.latestMFI.toFixed(1) : '-'}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">CMF</p>
                <SignalBadge signal={data.summary.cmfSignal} />
                <p className="text-[10px] mt-0.5 font-mono">{data.latestCMF !== null ? (data.latestCMF * 100).toFixed(1) + '%' : '-'}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">Kurumsal</p>
                <SignalBadge signal={data.summary.institutionalBias} />
                <p className="text-[10px] mt-0.5 font-mono">Blok: %{chartData.length > 0 ? chartData[chartData.length - 1].blockTradeRatio.toFixed(0) : '-'}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-0.5">Hacim</p>
                <p className="text-xs font-mono font-semibold">{formatVol(data.currentVolume)}</p>
                <p className="text-[10px] font-mono">
                  <span className={data.volumeRatio > 1.2 ? 'text-emerald-400' : data.volumeRatio < 0.8 ? 'text-red-400' : 'text-muted-foreground'}>
                    {data.volumeRatio.toFixed(1)}x ort
                  </span>
                </p>
              </div>
            </div>

            {/* Expandable Charts */}
            {!expanded ? (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(true)}>
                Grafikleri Göster
              </Button>
            ) : (
              <div className="space-y-3">
                {/* AD + Price */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Waves className="h-3 w-3 text-blue-400" /> Birikim/Dağıtım + Fiyat
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="ad" orientation="left" tick={{ fontSize: 8 }} stroke="#60a5fa" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                      <Area yAxisId="ad" type="monotone" dataKey="adNorm" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.1} strokeWidth={1.5} name="A/D" dot={false} isAnimationActive={false} />
                      <Line yAxisId="price" type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={false} name="Fiyat" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Institutional Flow */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-emerald-400" /> Kurumsal vs Bireysel Akış
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[-100, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                      <Bar dataKey="institutionalFlow" name="Kurumsal" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.institutionalFlow > 0 ? '#34d399' : '#f87171'} fillOpacity={0.7} />
                        ))}
                      </Bar>
                      <Bar dataKey="retailFlow" name="Bireysel" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.retailFlow > 0 ? '#60a5fa' : '#fb923c'} fillOpacity={0.5} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* MFI */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Percent className="h-3 w-3 text-amber-400" /> Para Akış Endeksi (MFI)
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="mfi" stroke="#fbbf24" strokeWidth={2} dot={false} name="MFI" isAnimationActive={false} />
                      <Line type="monotone" dataKey={() => 80} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Aşırı Alım" isAnimationActive={false} />
                      <Line type="monotone" dataKey={() => 20} stroke="#22c55e" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Aşırı Satım" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(false)}>
                  Grafikleri Gizle
                </Button>

                <p className="text-[10px] text-yellow-500/60 text-center">
                  ⚠️ Hacim paternlerinden üretilen tahmindir · Yatırım tavsiyesi değildir
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Bot, Play, Square, Trash2, TrendingUp, TrendingDown,
  MinusCircle, Zap, Settings, PlusCircle, Activity,
  AlertTriangle, CheckCircle2, Clock, Search, X,
  Flame, Shield, BarChart3, Layers,
} from 'lucide-react'
import { formatCurrency } from '@/lib/stock-utils'
import { toast } from 'sonner'

const STRATEGIES = [
  { id: 'SMA_CROSSOVER', name: 'SMA Kesişim', desc: 'SMA(5/10) hızlı kesişim + trend filtresi + hacim teyidi', icon: TrendingUp },
  { id: 'RSI_STRATEGY', name: 'RSI Kısa Vade', desc: 'RSI(9) + StochRSI(9) · Günlük hızlı sinyal + uyumsuzluk', icon: Activity },
  { id: 'RSI_LONG', name: 'RSI Uzun Vade', desc: 'RSI(14) + StochRSI(14) + SMA(50) trend · Swing sinyal', icon: Activity },
  { id: 'MACD_STRATEGY', name: 'Hızlı MACD', desc: 'MACD(5,13,6) histogram dönüşü + ivme analizi', icon: Zap },
  { id: 'BOLLINGER_STRATEGY', name: 'Bollinger Bantları', desc: 'BB(15,1.8) bant sıçrama/ret + sıkışma tespiti', icon: Settings },
  { id: 'COMBINED', name: 'Günlük Kombine', desc: '7 gösterge birleşik skor + hacim + ivme analizi', icon: Bot },
]

export function AutoTradeContent() {
  const { userId, isGuest, guestId } = useUserId()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [strategies, setStrategies] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [newStrategy, setNewStrategy] = useState('')
  const [newMaxAmount, setNewMaxAmount] = useState('50000')
  const [newMaxQty, setNewMaxQty] = useState('100')
  const [newMode, setNewMode] = useState<'normal' | 'aggressive'>('normal')
  const [lastExecResults, setLastExecResults] = useState<any[] | null>(null)

  // Stock search state
  const [stockSearch, setStockSearch] = useState('')
  const [showStockDropdown, setShowStockDropdown] = useState(false)
  const stockSearchRef = useRef<HTMLDivElement>(null)

  const selectedStockInfo = stocks.find((s: any) => s.symbol === newSymbol)

  const filteredStocks = stocks.filter((s: any) => {
    if (!stockSearch) return true
    const q = stockSearch.toLowerCase()
    return s.symbol?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)
  }).slice(0, 50)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (stockSearchRef.current && !stockSearchRef.current.contains(e.target as Node)) {
        setShowStockDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Read ?symbol= from URL and auto-fill
  useEffect(() => {
    const sym = searchParams?.get('symbol')
    if (sym && stocks.length > 0) {
      const found = stocks.find((s: any) => s.symbol === sym)
      if (found) {
        setNewSymbol(found.symbol)
        setStockSearch('')
        setShowCreate(true)
      }
    }
  }, [searchParams, stocks])

  const fetchStrategies = useCallback(async () => {
    if (!userId) return
    try {
      const params = isGuest ? `?guestId=${guestId}` : ''
      const res = await fetch(`/api/auto-trade${params}`)
      if (res.ok) {
        const data = await res.json()
        setStrategies(data ?? [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [userId, isGuest, guestId])

  useEffect(() => {
    fetch('/api/stocks').then(r => r.json()).then(d => setStocks(d ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (userId) fetchStrategies()
  }, [userId, fetchStrategies])

  // Check if BIST market is open (Mon-Fri, 09:55-18:10 Istanbul time)
  const isBISTOpen = useCallback(() => {
    const now = new Date()
    const istanbul = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
    const day = istanbul.getDay()
    if (day === 0 || day === 6) return false
    const h = istanbul.getHours()
    const m = istanbul.getMinutes()
    const mins = h * 60 + m
    return mins >= 595 && mins <= 1090
  }, [])

  // Auto-execute: normal every 60s, aggressive every 30s
  useEffect(() => {
    if (!userId) return
    const hasAggressive = strategies.some((s: any) => s.isActive && s.mode === 'aggressive')
    const intervalMs = hasAggressive ? 30000 : 60000
    
    const interval = setInterval(async () => {
      if (!isBISTOpen()) return
      try {
        const body: any = {}
        if (isGuest) body.guestId = guestId
        const res = await fetch('/api/auto-trade/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.results?.length > 0) setLastExecResults(data.results)
          if (data.executed > 0) {
            toast.success(`Otomatik işlem: ${data.executed} işlem gerçekleşti`)
            fetchStrategies()
          }
        }
      } catch (err) {
        console.error('Auto-execute error:', err)
      }
    }, intervalMs)
    return () => clearInterval(interval)
  }, [userId, isGuest, guestId, fetchStrategies, isBISTOpen, strategies])

  const handleCreate = async () => {
    if (!newSymbol || !newStrategy) {
      toast.error('Hisse ve strateji seçin')
      return
    }
    try {
      const res = await fetch('/api/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newSymbol,
          strategy: newStrategy,
          mode: newMode,
          maxAmount: parseFloat(newMaxAmount) || 50000,
          maxQuantity: parseInt(newMaxQty) || 100,
          guestId: isGuest ? guestId : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Strateji oluşturuldu')
        setShowCreate(false)
        setNewSymbol('')
        setNewStrategy('')
        setStockSearch('')
        setNewMode('normal')
        fetchStrategies()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Hata oluştu')
      }
    } catch (err) {
      toast.error('Bağlantı hatası')
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/auto-trade', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive, guestId: isGuest ? guestId : undefined }),
      })
      if (res.ok) {
        toast.success(isActive ? 'Strateji aktif' : 'Strateji durduruldu')
        fetchStrategies()
      }
    } catch (err) {
      toast.error('Güncelleme hatası')
    }
  }

  const handleModeChange = async (id: string, mode: string) => {
    try {
      const res = await fetch('/api/auto-trade', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, mode, guestId: isGuest ? guestId : undefined }),
      })
      if (res.ok) {
        toast.success(mode === 'aggressive' ? 'Agresif mod aktif' : 'Normal mod aktif')
        fetchStrategies()
      }
    } catch (err) {
      toast.error('Güncelleme hatası')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const params = isGuest ? `&guestId=${guestId}` : ''
      const res = await fetch(`/api/auto-trade?id=${id}${params}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Strateji silindi')
        fetchStrategies()
      }
    } catch (err) {
      toast.error('Silme hatası')
    }
  }

  const handleExecuteNow = async () => {
    setExecuting(true)
    try {
      const body: any = {}
      if (isGuest) body.guestId = guestId
      const res = await fetch('/api/auto-trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results?.length > 0) setLastExecResults(data.results)
        if (data.marketClosed) {
          toast.info('Borsa şu an kapalı — sinyal kontrolü yapılmadı')
        } else if (data.executed > 0) {
          toast.success(`${data.executed} işlem gerçekleştirildi!`)
        } else {
          toast.info('Şu an işlem sinyali yok')
        }
        fetchStrategies()
      }
    } catch (err) {
      toast.error('İşlem hatası')
    } finally {
      setExecuting(false)
    }
  }

  const getSignalIcon = (signal: string | null) => {
    if (signal === 'BUY') return <TrendingUp className="h-4 w-4 text-emerald-500" />
    if (signal === 'SELL') return <TrendingDown className="h-4 w-4 text-red-500" />
    return <MinusCircle className="h-4 w-4 text-yellow-500" />
  }

  const getSignalLabel = (signal: string | null) => {
    if (signal === 'BUY') return 'AL'
    if (signal === 'SELL') return 'SAT'
    return 'BEKLE'
  }

  // Guest restriction
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
          <Bot className="w-10 h-10 text-purple-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Otomatik Alım Satım</h2>
          <p className="text-muted-foreground max-w-md">
            Otomatik alım satım stratejileri oluşturmak ve yönetmek için kayıt olmanız gerekmektedir.
          </p>
        </div>
        <Button
          onClick={() => router.push('/auth/register')}
          className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-8 py-3 text-lg"
        >
          Kayıt Ol
        </Button>
        <p className="text-sm text-muted-foreground">
          Zaten hesabınız var mı?{' '}
          <button onClick={() => router.push('/auth/login')} className="text-purple-500 hover:underline">
            Giriş Yap
          </button>
        </p>
      </div>
    )
  }

  const activeCount = strategies.filter((s: any) => s.isActive).length
  const aggressiveCount = strategies.filter((s: any) => s.isActive && s.mode === 'aggressive').length

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Otomatik Alım Satım
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Çoklu zaman dilimi sinyalleri ile akıllı otomatik işlem
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExecuteNow} disabled={executing || activeCount === 0} className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> {executing ? 'Çalışıyor...' : 'Şimdi Çalıştır'}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" /> Yeni Strateji
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Summary */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{strategies.length}</p>
              <p className="text-xs text-muted-foreground">Toplam Strateji</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-500">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Aktif</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{aggressiveCount}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Flame className="h-3 w-3" /> Agresif</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{strategies.reduce((sum: number, s: any) => sum + (s.totalTrades ?? 0), 0)}</p>
              <p className="text-xs text-muted-foreground">Toplam İşlem</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${strategies.reduce((sum: number, s: any) => sum + (s.totalPnL ?? 0), 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCurrency(strategies.reduce((sum: number, s: any) => sum + (s.totalPnL ?? 0), 0))}
              </p>
              <p className="text-xs text-muted-foreground">Toplam K/Z</p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Create Form */}
      {showCreate && (
        <SlideIn>
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Yeni Strateji Oluştur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hisse</Label>
                  <div ref={stockSearchRef} className="relative">
                    {newSymbol && !showStockDropdown ? (
                      <div
                        className="flex items-center justify-between h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => { setShowStockDropdown(true); setStockSearch('') }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-primary">{newSymbol}</span>
                          <span className="text-muted-foreground text-xs truncate">{selectedStockInfo?.name}</span>
                        </span>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setNewSymbol(''); setStockSearch('') }} />
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={stockSearch}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setStockSearch(e.target.value); setShowStockDropdown(true) }}
                          onFocus={() => setShowStockDropdown(true)}
                          placeholder="Hisse ara (sembol veya isim)..."
                          className="pl-9"
                          autoComplete="off"
                        />
                      </div>
                    )}

                    {showStockDropdown && (
                      <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                        {filteredStocks.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground text-center">Sonuç bulunamadı</div>
                        ) : (
                          filteredStocks.map((s: any) => (
                            <button
                              key={s.symbol}
                              type="button"
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/60 transition-colors ${newSymbol === s.symbol ? 'bg-primary/10' : ''}`}
                              onClick={() => {
                                setNewSymbol(s.symbol)
                                setStockSearch('')
                                setShowStockDropdown(false)
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <span className="font-semibold w-14 text-left">{s.symbol}</span>
                                <span className="text-muted-foreground text-xs truncate">{s.name}</span>
                              </span>
                              {s.currentPrice > 0 && (
                                <span className="text-xs text-muted-foreground font-mono">{formatCurrency(s.currentPrice)}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Strateji</Label>
                  <Select value={newStrategy} onValueChange={setNewStrategy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Strateji seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Maks. Tutar (₺)</Label>
                  <Input type="number" value={newMaxAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaxAmount(e.target.value)} placeholder="50000" />
                </div>
                <div className="space-y-2">
                  <Label>Maks. Adet</Label>
                  <Input type="number" value={newMaxQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaxQty(e.target.value)} placeholder="100" />
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <Label>İşlem Modu</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewMode('normal')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      newMode === 'normal'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className={`h-5 w-5 ${newMode === 'normal' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-semibold">Normal Mod</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Güvenli strateji · %60+ güven eşiği · MTF uyum kontrolü · Her 60sn kontrol
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMode('aggressive')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      newMode === 'aggressive'
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className={`h-5 w-5 ${newMode === 'aggressive' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                      <span className="font-semibold">Agresif Mod</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hızlı al/sat · %30 güven eşiği · 1.5x limit · Her 30sn kontrol · Yüksek risk
                    </p>
                  </button>
                </div>
              </div>

              {newStrategy && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="font-medium">{STRATEGIES.find(s => s.id === newStrategy)?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{STRATEGIES.find(s => s.id === newStrategy)?.desc}</p>
                </div>
              )}

              {newMode === 'aggressive' && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm flex gap-2">
                  <Flame className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-orange-600 dark:text-orange-400">Agresif Mod Uyarısı</p>
                    <p className="text-xs text-muted-foreground">
                      Agresif modda: güven eşiği %30&apos;a düşer, alım/satım limitleri 1.5x artar, kontrol sıklığı 30sn&apos;ye iner.
                      Çoklu zaman dilimi çelişkisi olsa bile işlem yapabilir. Yüksek risk içerir!
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">Uyarı</p>
                  <p className="text-xs text-muted-foreground">Otomatik alım satım risk içerir. Çoklu zaman dilimi sinyalleri + teknik göstergelerle işlem yapar. Sanal para ile çalışır.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreate} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Oluştur
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Last execution results */}
      {lastExecResults && lastExecResults.length > 0 && (
        <FadeIn delay={0.08}>
          <Card className="border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" /> Son Sinyal Sonuçları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lastExecResults.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-muted/30 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold w-12">{r.symbol}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        r.signal === 'BUY' ? 'text-emerald-500 border-emerald-500/30' :
                        r.signal === 'SELL' ? 'text-red-500 border-red-500/30' :
                        'text-yellow-500 border-yellow-500/30'
                      }`}>
                        {r.signal === 'BUY' ? 'AL' : r.signal === 'SELL' ? 'SAT' : 'BEKLE'}
                      </Badge>
                      {r.mode === 'aggressive' && <Flame className="h-3 w-3 text-orange-500" />}
                      {r.executed && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    </div>
                    <div className="text-muted-foreground truncate max-w-xs">
                      {r.confidence && <span className="mr-2">%{r.confidence}</span>}
                      {r.reason?.split(' · ').slice(0, 2).join(' · ')}
                    </div>
                    {r.executed && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {r.tradeType === 'BUY' ? 'ALINDI' : 'SATILDI'} {r.quantity} ad. @ {formatCurrency(r.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setLastExecResults(null)}>
                Kapat
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Strategy List */}
      <FadeIn delay={0.15}>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
        ) : strategies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Henüz strateji oluşturmadınız</p>
              <p className="text-xs text-muted-foreground mt-1">Yukarıdaki &quot;Yeni Strateji&quot; butonuna tıklayın</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {strategies.map((strat: any) => {
              const stratInfo = STRATEGIES.find(s => s.id === strat.strategy)
              const Icon = stratInfo?.icon ?? Bot
              const isAggressive = strat.mode === 'aggressive'
              return (
                <Card key={strat.id} className={`transition-all ${
                  !strat.isActive ? 'opacity-60' :
                  isAggressive ? 'border-orange-500/30' : 'border-primary/30'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          !strat.isActive ? 'bg-muted' :
                          isAggressive ? 'bg-orange-500/10' : 'bg-primary/10'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            !strat.isActive ? 'text-muted-foreground' :
                            isAggressive ? 'text-orange-500' : 'text-primary'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              className="font-semibold hover:text-primary hover:underline underline-offset-2 transition-colors"
                              onClick={() => router.push(`/dashboard/trade?symbol=${strat.stock?.symbol}`)}
                            >
                              {strat.stock?.symbol}
                            </button>
                            <Badge variant="outline" className="text-xs">{stratInfo?.name ?? strat.strategy}</Badge>
                            {strat.isActive && (
                              isAggressive ? (
                                <Badge className="text-xs bg-orange-500/15 text-orange-500 border-orange-500/30 gap-1">
                                  <Flame className="h-3 w-3" /> Agresif
                                </Badge>
                              ) : (
                                <Badge className="text-xs bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                                  Aktif
                                </Badge>
                              )
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <button
                              className="hover:text-primary hover:underline underline-offset-2 transition-colors"
                              onClick={() => router.push(`/dashboard/trade?symbol=${strat.stock?.symbol}`)}
                            >
                              {strat.stock?.name}
                            </button>
                            {' '}· Maks: {formatCurrency(strat.maxAmount)}{isAggressive ? ' (×1.5)' : ''} / {strat.maxQuantity} adet
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Last Signal */}
                        <div className="flex items-center gap-1.5 text-sm">
                          {getSignalIcon(strat.lastSignal)}
                          <span className="text-xs font-medium">{getSignalLabel(strat.lastSignal)}</span>
                        </div>

                        {/* Stats */}
                        <div className="text-right text-xs">
                          <p>{strat.totalTrades} işlem</p>
                          <p className={strat.totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {formatCurrency(strat.totalPnL)}
                          </p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                          {/* Mode toggle */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${isAggressive ? 'text-orange-500 hover:text-orange-600' : 'text-muted-foreground hover:text-primary'}`}
                            onClick={() => handleModeChange(strat.id, isAggressive ? 'normal' : 'aggressive')}
                            title={isAggressive ? 'Normal moda geç' : 'Agresif moda geç'}
                          >
                            {isAggressive ? <Flame className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                          </Button>
                          <Switch
                            checked={strat.isActive}
                            onCheckedChange={(checked: boolean) => handleToggle(strat.id, checked)}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(strat.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {strat.lastChecked && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Son kontrol: {new Date(strat.lastChecked).toLocaleString('tr-TR')}
                        {isAggressive && ' · 30sn aralık'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </FadeIn>

      {/* How it works */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nasıl Çalışır?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</div>
                  <span className="font-semibold">Strateji Seçin</span>
                </div>
                <p className="text-xs text-muted-foreground pl-8">Hisse, teknik strateji ve işlem modunu belirleyin</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</div>
                  <span className="font-semibold">Çoklu Sinyal</span>
                </div>
                <p className="text-xs text-muted-foreground pl-8">Günlük + Haftalık + Aylık zaman dilimleri analiz edilir</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</div>
                  <span className="font-semibold">Uyum Kontrolü</span>
                </div>
                <p className="text-xs text-muted-foreground pl-8">Zaman dilimleri aynı yönü gösterdiğinde güven artar</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">4</div>
                  <span className="font-semibold">Otomatik İşlem</span>
                </div>
                <p className="text-xs text-muted-foreground pl-8">Normal: %60+ güven · Agresif: %30+ güven ile işlem</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Bell, Plus, Trash2, TrendingUp, TrendingDown, BellRing, Volume2, VolumeX, CheckCircle2
} from 'lucide-react'
import { formatCurrency } from '@/lib/stock-utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function AlertsContent() {
  const { userId, isGuest, guestId } = useUserId()
  const router = useRouter()
  const [alerts, setAlerts] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [condition, setCondition] = useState('ABOVE')
  const [creating, setCreating] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const triggeredAlertsRef = useRef<Set<string>>(new Set())
  const prevAlertsRef = useRef<any[]>([])

  const fetchAlerts = useCallback(async () => {
    if (!userId) return
    try {
      const guestParam = isGuest ? `?guestId=${guestId}` : ''
      const res = await fetch(`/api/alerts${guestParam}`)
      if (res?.ok) {
        const data = await res.json()
        setAlerts(data ?? [])
      }
    } catch (err: any) {
      console.error('Alerts fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isGuest, guestId])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Poll alerts every 30s to detect newly triggered
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [userId, fetchAlerts])

  // Check for newly triggered alerts and notify
  useEffect(() => {
    if (alerts.length === 0) return
    alerts.forEach((alert: any) => {
      const currentPrice = alert?.stock?.currentPrice ?? 0
      const isTriggered =
        (alert?.condition === 'ABOVE' && currentPrice >= (alert?.targetPrice ?? 0)) ||
        (alert?.condition === 'BELOW' && currentPrice <= (alert?.targetPrice ?? 0))

      if (isTriggered && !triggeredAlertsRef.current.has(alert.id)) {
        triggeredAlertsRef.current.add(alert.id)
        // Only notify if this wasn't already triggered on load
        const wasPrevTriggered = prevAlertsRef.current.find((a: any) => {
          const cp = a?.stock?.currentPrice ?? 0
          const t = (a?.condition === 'ABOVE' && cp >= (a?.targetPrice ?? 0)) ||
                    (a?.condition === 'BELOW' && cp <= (a?.targetPrice ?? 0))
          return a.id === alert.id && t
        })
        if (!wasPrevTriggered && prevAlertsRef.current.length > 0) {
          toast.success(
            `🔔 ${alert?.stock?.symbol} alarmı tetiklendi! Fiyat: ${formatCurrency(currentPrice)}`,
            { duration: 8000 }
          )
          // Play sound
          if (soundEnabled) {
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
              const osc = audioCtx.createOscillator()
              const gain = audioCtx.createGain()
              osc.connect(gain)
              gain.connect(audioCtx.destination)
              osc.frequency.value = 800
              osc.type = 'sine'
              gain.gain.value = 0.15
              osc.start()
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)
              osc.stop(audioCtx.currentTime + 0.5)
            } catch (e) { /* ignore audio errors */ }
          }
        }
      }
    })
    prevAlertsRef.current = alerts
  }, [alerts, soundEnabled])

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

  const handleCreateAlert = async () => {
    if (!selectedSymbol || !targetPrice || !condition) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          targetPrice: parseFloat(targetPrice),
          condition,
          guestId: isGuest ? guestId : undefined,
        }),
      })
      if (res?.ok) {
        toast.success('Alarm oluşturuldu!')
        setDialogOpen(false)
        setSelectedSymbol('')
        setTargetPrice('')
        setCondition('ABOVE')
        fetchAlerts()
      } else {
        const data = await res?.json()
        toast.error(data?.error ?? 'Alarm oluşturulamadı')
      }
    } catch (err: any) {
      console.error('Create alert error:', err)
      toast.error('Alarm oluşturulamadı')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const guestParam = isGuest ? `&guestId=${guestId}` : ''
      const res = await fetch(`/api/alerts?id=${alertId}${guestParam}`, { method: 'DELETE' })
      if (res?.ok) {
        toast.success('Alarm silindi')
        triggeredAlertsRef.current.delete(alertId)
        fetchAlerts()
      }
    } catch (err: any) {
      console.error('Delete alert error:', err)
      toast.error('Alarm silinemedi')
    }
  }

  // Count triggered
  const triggeredCount = alerts.filter((a: any) => {
    const cp = a?.stock?.currentPrice ?? 0
    return (a?.condition === 'ABOVE' && cp >= (a?.targetPrice ?? 0)) ||
           (a?.condition === 'BELOW' && cp <= (a?.targetPrice ?? 0))
  }).length

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{`Fiyat Alarmları`}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {`Hedef fiyat alarmları oluşturun`}
              {triggeredCount > 0 && (
                <span className="ml-2 text-emerald-500 font-medium">
                  • {triggeredCount} alarm tetiklendi
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Sesi kapat' : 'Sesi aç'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Yeni Alarm
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{`Fiyat Alarmı Oluştur`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Hisse</Label>
                    <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Hisse seçin`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(stocks ?? []).map((s: any) => (
                          <SelectItem key={s?.symbol} value={s?.symbol ?? ''}>
                            {s?.symbol} - {s?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{`Koşul`}</Label>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ABOVE">{`Fiyat üstüne çıktığında`}</SelectItem>
                        <SelectItem value="BELOW">{`Fiyat altına düştüğünde`}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{`Hedef Fiyat (₺)`}</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={targetPrice}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetPrice(e?.target?.value ?? '')}
                    />
                  </div>

                  {selectedSymbol && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <p className="text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">{selectedSymbol}</span> {`güncel fiyat:`}{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {formatCurrency((stocks ?? []).find((s: any) => s?.symbol === selectedSymbol)?.currentPrice)}
                        </span>
                      </p>
                    </div>
                  )}

                  <Button className="w-full" onClick={handleCreateAlert} disabled={creating}>
                    {creating ? 'Oluşturuluyor...' : 'Alarm Oluştur'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </FadeIn>

      {/* Alerts List */}
      <FadeIn delay={0.1}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[...Array(3)].map((_: any, i: number) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (alerts?.length ?? 0) === 0 ? (
              <div className="text-center py-12">
                <BellRing className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">{`Henüz alarm yok`}</p>
                <p className="text-xs text-muted-foreground">{`Hisse fiyatı hedefinize ulaştığında bildirim almak için alarm oluşturun`}</p>
              </div>
            ) : (
              <div className="divide-y">
                {alerts.map((alert: any) => {
                  const currentPrice = alert?.stock?.currentPrice ?? 0
                  const isTriggered =
                    (alert?.condition === 'ABOVE' && currentPrice >= (alert?.targetPrice ?? 0)) ||
                    (alert?.condition === 'BELOW' && currentPrice <= (alert?.targetPrice ?? 0))
                  const progress = alert?.condition === 'ABOVE'
                    ? Math.min(100, (currentPrice / (alert?.targetPrice || 1)) * 100)
                    : Math.min(100, ((alert?.targetPrice || 1) / (currentPrice || 1)) * 100)

                  return (
                    <div key={alert?.id} className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${
                      isTriggered ? 'bg-emerald-500/5' : ''
                    }`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center ${
                          isTriggered ? 'bg-emerald-500/10' : 'bg-muted'
                        }`}>
                          {alert?.condition === 'ABOVE'
                            ? <TrendingUp className={`h-5 w-5 ${isTriggered ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                            : <TrendingDown className={`h-5 w-5 ${isTriggered ? 'text-emerald-500' : 'text-muted-foreground'}`} />}
                          {isTriggered && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              className="font-mono font-semibold text-sm hover:text-primary hover:underline transition-colors text-left"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/trade?symbol=${alert?.stock?.symbol}`)
                              }}
                            >
                              {alert?.stock?.symbol}
                            </button>
                            <span className="text-xs text-muted-foreground hidden sm:inline">{alert?.stock?.name}</span>
                            {isTriggered && (
                              <Badge variant="default" className="text-xs bg-emerald-500 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Tetiklendi
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {alert?.condition === 'ABOVE' ? `Fiyat üstüne çıktığında` : `Fiyat altına düştüğünde`} {formatCurrency(alert?.targetPrice)}
                          </p>
                          {/* Progress bar to target */}
                          {!isTriggered && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {`Güncel: ${formatCurrency(currentPrice)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleDeleteAlert(alert?.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

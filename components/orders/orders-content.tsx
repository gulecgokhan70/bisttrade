'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserId } from '@/hooks/use-user-id'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ListOrdered, TrendingUp, TrendingDown, X, Clock, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react'
import {
  formatCurrency, getOrderTypeLabel, getOrderStatusLabel, getOrderStatusColor,
} from '@/lib/stock-utils'
import { toast } from 'sonner'

export function OrdersContent() {
  const { userId, isGuest, guestId } = useUserId()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    if (!userId) return
    try {
      const params = new URLSearchParams()
      if (isGuest && guestId) params.set('guestId', guestId)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const res = await fetch(`/api/orders?${params.toString()}`)
      if (res?.ok) {
        const data = await res.json()
        setOrders(data ?? [])
      }
    } catch (err: any) {
      console.error('Orders fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isGuest, guestId, statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    if (!userId) return
    const interval = setInterval(fetchOrders, 1000)
    return () => clearInterval(interval)
  }, [userId, fetchOrders])

  const handleCancelOrder = async (orderId: string) => {
    try {
      const guestParam = isGuest ? `&guestId=${guestId}` : ''
      const res = await fetch(`/api/orders?id=${orderId}${guestParam}`, { method: 'DELETE' })
      if (res?.ok) {
        toast.success('Emir iptal edildi')
        fetchOrders()
      } else {
        toast.error('Emir iptal edilemedi')
      }
    } catch (err: any) {
      toast.error('Emir iptal edilemedi')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'EXECUTED': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-red-500" />
      case 'EXPIRED': return <AlertCircle className="h-4 w-4 text-muted-foreground" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Emirlerim</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bekleyen, gerçekleşen ve iptal edilen emirlerinizi yönetin
          </p>
        </div>
      </FadeIn>

      {/* Status Filter */}
      <FadeIn delay={0.1}>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="ALL">Tümü</TabsTrigger>
            <TabsTrigger value="PENDING">Bekleyen</TabsTrigger>
            <TabsTrigger value="EXECUTED">Gerçekleşen</TabsTrigger>
            <TabsTrigger value="CANCELLED">İptal</TabsTrigger>
          </TabsList>
        </Tabs>
      </FadeIn>

      {/* Orders List */}
      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[...Array(4)].map((_: any, i: number) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (orders?.length ?? 0) === 0 ? (
              <div className="text-center py-12">
                <ListOrdered className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Henüz emir yok</p>
                <p className="text-xs text-muted-foreground mb-4">Alım satım sayfasından gelişmiş emirler oluşturabilirsiniz</p>
                <Button size="sm" onClick={() => router.push('/dashboard/trade')}>
                  Trade Başlat
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Durum</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Hisse</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tip</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Emir Türü</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Adet</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Fiyat Detayı</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Tarih</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order: any) => (
                      <tr key={order?.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order?.status)}
                            <Badge className={`text-xs ${getOrderStatusColor(order?.status)}`}>
                              {getOrderStatusLabel(order?.status)}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold text-sm">{order?.stock?.symbol}</p>
                          <p className="text-xs text-muted-foreground">{order?.stock?.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={order?.type === 'BUY' ? 'default' : 'destructive'}
                            className="text-xs gap-1"
                          >
                            {order?.type === 'BUY'
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />}
                            {order?.type === 'BUY' ? 'AL' : 'SAT'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {getOrderTypeLabel(order?.orderType)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">{order?.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-xs font-mono space-y-0.5">
                            {order?.limitPrice && (
                              <p>Limit: {formatCurrency(order.limitPrice)}</p>
                            )}
                            {order?.stopPrice && (
                              <p>Stop: {formatCurrency(order.stopPrice)}</p>
                            )}
                            {order?.trailingPercent && (
                              <p>Takip: %{order.trailingPercent}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground">
                          {order?.createdAt ? new Date(order.createdAt).toLocaleDateString('tr-TR') : 'N/A'}
                          <br />
                          {order?.createdAt ? new Date(order.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {order?.status === 'PENDING' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              onClick={() => handleCancelOrder(order?.id)}
                            >
                              <X className="h-3 w-3 mr-1" /> İptal
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

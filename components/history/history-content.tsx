'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserId } from '@/hooks/use-user-id'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Receipt } from 'lucide-react'
import { formatCurrency, getOrderTypeLabel } from '@/lib/stock-utils'

export function HistoryContent() {
  const { userId, isGuest, guestId } = useUserId()
  const [transactions, setTransactions] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  const fetchTransactions = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (isGuest && guestId) params.set('guestId', guestId)
      if (search) params.set('search', search)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      params.set('page', page.toString())
      params.set('limit', '15')

      const res = await fetch(`/api/transactions?${params.toString()}`)
      if (res?.ok) {
        const data = await res.json()
        setTransactions(data?.transactions ?? [])
        setTotal(data?.total ?? 0)
        setPages(data?.pages ?? 1)
      }
    } catch (err: any) {
      console.error('Transactions fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isGuest, guestId, search, typeFilter, page])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">İşlem Geçmişi</h1>
          <p className="text-sm text-muted-foreground mt-1">Tüm alım satım işlemlerinizi görüntüleyin</p>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hisse ara..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearch(e?.target?.value ?? '')
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
          <Tabs value={typeFilter} onValueChange={(v: string) => { setTypeFilter(v); setPage(1) }}>
            <TabsList>
              <TabsTrigger value="ALL">Tümü</TabsTrigger>
              <TabsTrigger value="BUY">Alımlar</TabsTrigger>
              <TabsTrigger value="SELL">Satımlar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </FadeIn>

      {/* Transactions Table */}
      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_: any, i: number) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (transactions?.length ?? 0) === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">İşlem bulunamadı</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tarih</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tip</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Hisse</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Emir</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Adet</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Fiyat</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx: any) => (
                        <tr key={tx?.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                            {tx?.createdAt ? new Date(tx.createdAt).toLocaleDateString('tr-TR') : 'N/A'}
                            <br />
                            <span className="text-xs">
                              {tx?.createdAt ? new Date(tx.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={tx?.type === 'BUY' ? 'default' : 'destructive'}
                              className="text-xs gap-1"
                            >
                              {tx?.type === 'BUY'
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />}
                              {tx?.type === 'BUY' ? 'AL' : 'SAT'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono font-semibold text-sm">{tx?.stock?.symbol}</p>
                            <p className="text-xs text-muted-foreground">{tx?.stock?.name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {getOrderTypeLabel(tx?.orderType ?? 'MARKET')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{tx?.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(tx?.price)}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-medium">{formatCurrency(tx?.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Sayfa {page} / {pages} ({total} işlem)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-3 w-3" /> Önceki
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= pages}
                        onClick={() => setPage(page + 1)}
                        className="gap-1"
                      >
                        Sonraki <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

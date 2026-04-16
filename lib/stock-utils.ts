// Simulate realistic price movements
export function simulatePriceChange(currentPrice: number, volatility: number = 0.002): number {
  const change = (Math.random() - 0.5) * 2 * volatility * currentPrice
  return Math.max(0.01, parseFloat((currentPrice + change).toFixed(2)))
}

export function formatCurrency(value: number | null | undefined): string {
  const v = value ?? 0
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

export function formatNumber(value: number | null | undefined): string {
  const v = value ?? 0
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(2)
}

export function formatPercent(value: number | null | undefined): string {
  const v = value ?? 0
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

export function getChangeColor(change: number | null | undefined): string {
  const v = change ?? 0
  if (v > 0) return 'text-emerald-500'
  if (v < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

export function getBgChangeColor(change: number | null | undefined): string {
  const v = change ?? 0
  if (v > 0) return 'bg-emerald-500/10 text-emerald-500'
  if (v < 0) return 'bg-red-500/10 text-red-500'
  return 'bg-muted text-muted-foreground'
}

export function getOrderTypeLabel(orderType: string): string {
  switch (orderType) {
    case 'MARKET': return 'Piyasa'
    case 'LIMIT': return 'Limit'
    case 'STOP_LOSS': return 'Zarar Durdur'
    case 'STOP_LIMIT': return 'Stop Limit'
    case 'TRAILING_STOP': return 'Takip Eden Stop'
    case 'AUTO': return 'Otomatik'
    default: return orderType
  }
}

export function getOrderStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING': return 'Beklemede'
    case 'EXECUTED': return 'Gerçekleşti'
    case 'CANCELLED': return 'İptal'
    case 'EXPIRED': return 'Süresi Doldu'
    default: return status
  }
}

export function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'bg-yellow-500/10 text-yellow-600'
    case 'EXECUTED': return 'bg-emerald-500/10 text-emerald-500'
    case 'CANCELLED': return 'bg-red-500/10 text-red-500'
    case 'EXPIRED': return 'bg-muted text-muted-foreground'
    default: return 'bg-muted text-muted-foreground'
  }
}

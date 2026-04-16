'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Bell, Menu, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { formatCurrency, getChangeColor } from '@/lib/stock-utils'

export function DashboardHeader({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { data: session } = useSession() || {}
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [stocks, setStocks] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Fetch stocks for search
  useEffect(() => {
    fetch('/api/stocks')
      .then(r => r.ok ? r.json() : [])
      .then(d => setStocks(d ?? []))
      .catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = searchQuery.trim()
    ? (stocks ?? []).filter((s: any) => {
        const q = searchQuery.toLowerCase()
        return s?.symbol?.toLowerCase()?.includes(q) || s?.name?.toLowerCase()?.includes(q)
      }).slice(0, 8)
    : []

  const handleSelect = useCallback((stock: any) => {
    setSearchQuery('')
    setShowResults(false)
    setSelectedIndex(-1)
    router.push(`/dashboard/trade?symbol=${stock.symbol}`)
  }, [router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || filtered.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        e.preventDefault()
        router.push(`/dashboard/market?search=${encodeURIComponent(searchQuery.trim())}`)
        setShowResults(false)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex])
      } else if (searchQuery.trim()) {
        router.push(`/dashboard/market?search=${encodeURIComponent(searchQuery.trim())}`)
        setShowResults(false)
      }
    } else if (e.key === 'Escape') {
      setShowResults(false)
    }
  }

  if (!mounted) return <div className="h-14" />

  return (
    <div className="flex items-center gap-2 sm:gap-4 w-full">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0 h-9 w-9"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div ref={searchRef} className="relative flex-1 min-w-0 max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          placeholder="Hisse ara..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchQuery(e?.target?.value ?? '')
            setShowResults(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 h-9 sm:h-10 text-sm bg-muted/30 border border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-muted/50 backdrop-blur-sm transition-all placeholder:text-muted-foreground/60"
        />
        {showResults && searchQuery.trim() && (
          <div className="absolute z-50 top-full mt-2 w-full bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
            {filtered.length > 0 ? (
              <>
                <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/40">
                  {filtered.length} sonuç
                </div>
                {filtered.map((s: any, idx: number) => {
                  const change = (s?.currentPrice ?? 0) - (s?.previousClose ?? 0)
                  const changePct = (s?.previousClose ?? 1) !== 0
                    ? (change / (s?.previousClose ?? 1)) * 100 : 0
                  return (
                    <button
                      key={s?.id}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-150 ${
                        idx === selectedIndex ? 'bg-primary/10 backdrop-blur-sm' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelect(s)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/60">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-sm">{s?.symbol}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{s?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium">{formatCurrency(s?.currentPrice)}</p>
                        <p className={`text-[11px] font-mono ${getChangeColor(change)}`}>
                          {change >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                        </p>
                      </div>
                    </button>
                  )
                })}
                <div className="px-4 py-2.5 text-[10px] text-muted-foreground border-t border-border/40 text-center">
                  Enter ile piyasada ara · ↑↓ ile seç
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <Search className="h-5 w-5 mx-auto mb-2 opacity-50" />
                &quot;{searchQuery}&quot; için sonuç bulunamadı
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/alerts')}
          className="relative h-9 w-9"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </div>
  )
}

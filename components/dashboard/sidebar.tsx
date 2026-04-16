'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/use-subscription'
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  History,
  Bell,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Bot,
  Eye,
  BarChart3,
  Crown,
  Lock,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Piyasa', icon: LayoutDashboard },
  { href: '/dashboard/market', label: 'Liste', icon: TrendingUp },
  { href: '/dashboard/watchlist', label: 'İzleme Listesi', icon: Eye },
  { href: '/dashboard/analysis', label: 'Analiz', icon: BarChart3, premium: true },
  { href: '/dashboard/auto-trade', label: 'Oto Al/Sat', icon: Bot, premium: true },
  { href: '/dashboard/orders', label: 'Emirlerim', icon: ListOrdered },
  { href: '/dashboard/portfolio', label: 'Portföy', icon: Briefcase },
  { href: '/dashboard/history', label: 'Geçmiş', icon: History },
  { href: '/dashboard/alerts', label: 'Alarmlar', icon: Bell },
]

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { data: session, status } = useSession() || {}
  const pathname = usePathname()
  const router = useRouter()
  const [isGuest, setIsGuest] = useState(false)
  const { isPremium } = useSubscription()

  useEffect(() => {
    if (status === 'unauthenticated') {
      const guestId = typeof window !== 'undefined' ? localStorage.getItem('tradex_guest_id') : null
      setIsGuest(!!guestId)
    }
  }, [status])

  return (
    <div className={cn(
      'flex flex-col h-full transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm shrink-0">
          BT
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-lg tracking-tight">BIST Trade</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('ml-auto h-7 w-7 shrink-0', collapsed && 'ml-0')}
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item: any) => {
          const isActive = pathname === item?.href || (item?.href !== '/dashboard' && pathname?.startsWith?.(item?.href))
          const Icon = item?.icon
          return (
            <Link
              key={item?.href}
              href={item?.href}
              onClick={() => onNavigate?.()}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-fast',
                isActive
                  ? 'bg-primary/5 text-primary border border-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="flex-1 flex items-center gap-2">
                  {item?.label}
                  {item?.premium && !isPremium && (
                    <Lock className="h-3 w-3 text-amber-500" />
                  )}
                  {item?.premium && isPremium && (
                    <Crown className="h-3 w-3 text-amber-500" />
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Premium CTA / Status */}
      <div className="px-2 pb-2">
        {isPremium ? (
          <Link
            href="/dashboard/pricing"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500 text-sm font-medium',
              collapsed && 'justify-center px-0'
            )}
          >
            <Crown className="h-4 w-4 shrink-0" />
            {!collapsed && 'Premium Aktif'}
          </Link>
        ) : (
          <Link
            href="/dashboard/pricing"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-500 text-sm font-medium hover:from-amber-500/20 hover:to-orange-500/20 transition-colors',
              collapsed && 'justify-center px-0'
            )}
          >
            <Crown className="h-4 w-4 shrink-0" />
            {!collapsed && "Premium'a Yükselt"}
          </Link>
        )}
      </div>

      {/* User section */}
      <div className="border-t border-border p-3 space-y-2">
        {session?.user ? (
          <>
            {!collapsed && (
              <div className="px-2 mb-2">
                <p className="text-sm font-medium truncate">{session?.user?.name ?? 'Trader'}</p>
                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn('w-full text-muted-foreground hover:text-destructive', !collapsed && 'justify-start gap-2')}
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && 'Çıkış Yap'}
            </Button>
          </>
        ) : isGuest ? (
          <>
            {!collapsed && (
              <div className="px-2 mb-2">
                <p className="text-sm font-medium">Misafir Trader</p>
                <p className="text-xs text-muted-foreground">Demo Hesap</p>
              </div>
            )}
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn('w-full', !collapsed && 'justify-start gap-2')}
              onClick={() => router.push('/login')}
            >
              <LogIn className="h-4 w-4" />
              {!collapsed && 'Giriş Yap'}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
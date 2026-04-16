'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Bot,
  Eye,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Piyasa', icon: LayoutDashboard },
  { href: '/dashboard/market', label: 'Liste', icon: TrendingUp },
  { href: '/dashboard/watchlist', label: 'İzleme', icon: Eye },
  { href: '/dashboard/auto-trade', label: 'Oto', icon: Bot },
  { href: '/dashboard/portfolio', label: 'Portföy', icon: Briefcase },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/40 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
          const Icon = item.icon
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]')} />
              <span className={cn('text-[10px] font-medium', isActive && 'font-bold')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

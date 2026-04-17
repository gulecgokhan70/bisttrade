'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { DashboardHeader } from './header'
import { CurrencyTicker } from './currency-ticker'

import { cn } from '@/lib/utils'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      const guestId = typeof window !== 'undefined' ? localStorage.getItem('tradex_guest_id') : null
      if (!guestId) {
        router.replace('/')
        return
      }
    }
    setIsReady(true)
  }, [status, router])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">BIST Trade yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 border-r border-border/40 bg-background/80 backdrop-blur-xl transition-all duration-300 lg:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </aside>

      {/* Main */}
      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'
      )}>
        <header
          className="sticky top-0 z-30 border-b border-border/40 bg-card/95 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <CurrencyTicker />
          <div className="h-12 sm:h-14 flex items-center px-3 sm:px-6">
            <DashboardHeader onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
          </div>
        </header>
        <main className="p-3 sm:p-6">
          {children}
        </main>

        {/* Yasal Uyarı */}
        <footer className="px-3 sm:px-6 pb-4 pt-2">
          <div className="bg-muted/30 rounded-lg px-4 py-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground/60">
              ⚖️ <strong className="text-muted-foreground/70">Yasal Uyarı:</strong> BIST Trade eğitim ve simülasyon amaçlı bir uygulamadır. Tüm işlemler sanaldır, gerçek para kullanılmamaktadır.
              Sunulan veriler, analizler ve sinyaller yatırım danışmanlığı veya yatırım tavsiyesi niteliği taşımaz.
              Fiyat verileri üçüncü parti kaynaklardan sağlanır ve 15 dakikaya kadar gecikme içerebilir.
              Gerçek yatırım kararlarınız için lisanslı bir yatırım danışmanına başvurunuz. Bu uygulama Borsa İstanbul A.Ş. ile resmi bir bağlantıya sahip değildir.
            </p>
          </div>
        </footer>
      </div>

    </div>
  )
}

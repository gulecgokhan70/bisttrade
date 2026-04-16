'use client'

import { useSubscription } from '@/hooks/use-subscription'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, Crown, Sparkles } from 'lucide-react'

interface PremiumGateProps {
  children: React.ReactNode
  feature?: string
}

export function PremiumGate({ children, feature }: PremiumGateProps) {
  const { isPremium, loading } = useSubscription()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (isPremium) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-primary/20 shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Premium \u00D6zellik</h3>
              <p className="text-muted-foreground text-sm">
                {feature ? `${feature} \u00F6zelli\u011Fi` : 'Bu \u00F6zellik'} Premium aboneli\u011Fe \u00F6zeldir.
                7 g\u00FCn \u00FCcretsiz deneyin!
              </p>
            </div>
            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold"
                onClick={() => router.push('/dashboard/pricing')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Premium'a Y\u00FCkselt
              </Button>
              <p className="text-xs text-muted-foreground">\u20BA49,90/ay'dan ba\u015Flayan fiyatlarla</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="opacity-20 pointer-events-none select-none">
        {children}
      </div>
    </div>
  )
}

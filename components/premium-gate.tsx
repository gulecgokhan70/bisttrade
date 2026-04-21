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

export function PremiumGate({ children, feature, className }: PremiumGateProps & { className?: string }) {
  const { isPremium, loading } = useSubscription()
  const router = useRouter()

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] ${className ?? ''}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (isPremium) {
    return <div className={className ?? ''}>{children}</div>
  }

  return (
    <div className={`relative min-h-[320px] ${className ?? ''}`}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-primary/20 shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Premium \u00d6zellik</h3>
              <p className="text-muted-foreground text-sm">
                {feature ? `${feature} \u00f6zelli\u011fi` : 'Bu \u00f6zellik'} Premium aboneli\u011fe \u00f6zeldir.
                7 g\u00fcn \u00fccretsiz deneyin!
              </p>
            </div>
            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold"
                onClick={() => router.push('/dashboard/pricing')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Premium'a Y\u00fckselt
              </Button>
              <p className="text-xs text-muted-foreground">\u20a449,90/ay'dan ba\u015flayan fiyatlarla</p>
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

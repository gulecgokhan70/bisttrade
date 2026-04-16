'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSubscription } from '@/hooks/use-subscription'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Crown,
  Check,
  Sparkles,
  Zap,
  Shield,
  Star,
  Gift,
  Settings,
  Loader2,
  PartyPopper,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

const FREE_FEATURES = [
  'Piyasa listesi',
  'Temel al/sat i\u015Flemleri',
  'Portf\u00F6y takibi',
  '\u0130zleme listesi',
  'Emir y\u00F6netimi',
  '3 fiyat alarm\u0131',
]

const PREMIUM_FEATURES = [
  'T\u00FCm \u00FCcretsiz \u00F6zellikler',
  'Teknik analiz ara\u00E7lar\u0131',
  'Otomatik al/sat stratejileri',
  'Balina radar\u0131',
  'S\u0131n\u0131rs\u0131z fiyat alarm\u0131',
  '\u00D6ncelikli destek',
]

export function PricingContent() {
  const { data: session } = useSession() || {}
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isPremium, isTrialing, tier, loading: subLoading, trialEndsAt, expiresAt } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'YEARLY'>('YEARLY')
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponResult, setCouponResult] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (searchParams?.get('success') === 'true') {
      toast.success('Abonelik ba\u015Far\u0131yla aktif edildi! \u{1F389}')
    }
    if (searchParams?.get('cancelled') === 'true') {
      toast.info('\u00D6deme iptal edildi')
    }
  }, [searchParams])

  const handleCheckout = async () => {
    if (!session?.user) {
      router.push('/login')
      return
    }
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, couponCode: couponCode || undefined }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || '\u00D6deme ba\u015Flat\u0131lamad\u0131')
      }
    } catch {
      toast.error('Bir hata olu\u015Ftu')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Portal a\u00E7\u0131lamad\u0131')
      }
    } catch {
      toast.error('Bir hata olu\u015Ftu')
    } finally {
      setPortalLoading(false)
    }
  }

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponResult(null)
    try {
      const res = await fetch('/api/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      })
      const data = await res.json()
      if (res.ok) {
        setCouponResult({ valid: true, ...data })
      } else {
        setCouponResult({ valid: false, error: data.error })
      }
    } catch {
      setCouponResult({ valid: false, error: 'Bir hata olu\u015Ftu' })
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/coupon/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        setCouponCode('')
        setCouponResult(null)
        // Refresh page to update subscription status
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error(data.error || 'Kupon kullan\u0131lamad\u0131')
      }
    } catch {
      toast.error('Bir hata olu\u015Ftu')
    } finally {
      setCouponLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium">
          <Crown className="h-4 w-4" />
          Premium
        </div>
        <h1 className="text-3xl font-bold">Plan\u0131n\u0131z\u0131 Se\u00E7in</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          BIST Trade Premium ile teknik analiz, otomatik al/sat ve daha fazlas\u0131na eri\u015Fin.
          7 g\u00FCn \u00FCcretsiz deneyin!
        </p>
      </div>

      {/* Current subscription status */}
      {isPremium && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-amber-500">
                  {isTrialing ? 'Deneme S\u00FCresi Aktif' : 'Premium Aktif'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isTrialing && trialEndsAt
                    ? `Deneme ${formatDate(trialEndsAt)} tarihine kadar`
                    : expiresAt
                    ? `${formatDate(expiresAt)} tarihine kadar ge\u00E7erli`
                    : 'Aktif abonelik'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
              Aboneli\u011Fi Y\u00F6net
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan toggle */}
      {!isPremium && (
        <div className="flex justify-center">
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPlan === 'MONTHLY' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setSelectedPlan('MONTHLY')}
            >
              Ayl\u0131k
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedPlan === 'YEARLY' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setSelectedPlan('YEARLY')}
            >
              Y\u0131ll\u0131k
              <Badge className="bg-emerald-500/10 text-emerald-500 border-0 text-xs">%17 Tasarruf</Badge>
            </button>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <Card className={`relative ${tier === 'FREE' && !isPremium ? 'border-primary/30' : ''}`}>
          {tier === 'FREE' && !isPremium && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="secondary" className="text-xs">Mevcut Plan</Badge>
            </div>
          )}
          <CardHeader className="pb-4">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">\u00DCcretsiz</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">\u20BA0</span>
                <span className="text-muted-foreground">/ay</span>
              </div>
              <p className="text-sm text-muted-foreground">Temel \u00F6zelliklerle ba\u015Flay\u0131n</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Premium Plan */}
        <Card className={`relative border-amber-500/30 ${isPremium ? 'ring-2 ring-amber-500/20' : ''}`}>
          {isPremium && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-amber-500 text-white border-0 text-xs">Aktif</Badge>
            </div>
          )}
          <div className="absolute -top-3 right-4">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs">
              <Star className="h-3 w-3 mr-1" /> \u00D6nerilen
            </Badge>
          </div>
          <CardHeader className="pb-4">
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Premium
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {selectedPlan === 'MONTHLY' ? '\u20BA49,90' : '\u20BA499'}
                </span>
                <span className="text-muted-foreground">
                  /{selectedPlan === 'MONTHLY' ? 'ay' : 'y\u0131l'}
                </span>
              </div>
              {selectedPlan === 'YEARLY' && (
                <p className="text-sm text-emerald-500 font-medium">\u20BA41,58/ay - Ayl\u0131k \u00F6demeye g\u00F6re %17 tasarruf!</p>
              )}
              <p className="text-sm text-muted-foreground">7 g\u00FCn \u00FCcretsiz deneme ile ba\u015Flay\u0131n</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {PREMIUM_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {!isPremium && (
              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold mt-4"
                size="lg"
                onClick={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                7 G\u00FCn \u00DCcretsiz Dene
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coupon Code Section */}
      {!isPremium && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Kupon Kodu</h3>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Kupon kodunuzu girin"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                className="max-w-xs uppercase"
              />
              {couponResult?.valid && couponResult?.discountPercent === 100 ? (
                <Button onClick={handleRedeemCoupon} disabled={couponLoading}>
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kullan'}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleValidateCoupon} disabled={couponLoading || !couponCode.trim()}>
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kontrol Et'}
                </Button>
              )}
            </div>
            {couponResult && (
              <div className={`mt-3 text-sm ${
                couponResult.valid ? 'text-emerald-500' : 'text-destructive'
              }`}>
                {couponResult.valid ? (
                  <div className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4" />
                    {couponResult.message}
                  </div>
                ) : (
                  couponResult.error
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security note */}
      <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Shield className="h-4 w-4" />
        <span>G\u00FCvenli \u00F6deme Stripe altyap\u0131s\u0131 ile sa\u011Flanmaktad\u0131r</span>
      </div>
    </div>
  )
}

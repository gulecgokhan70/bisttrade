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
  'Temel al/sat işlemleri',
  'Portföy takibi',
  'İzleme listesi',
  'Emir yönetimi',
  '3 fiyat alarmı',
]

const PREMIUM_FEATURES = [
  'Tüm ücretsiz özellikler',
  'Teknik analiz araçları',
  'Otomatik al/sat stratejileri',
  'Balina radarı',
  'Sınırsız fiyat alarmı',
  'Öncelikli destek',
]

export function PricingContent() {
  const { data: session } = useSession() || {}
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isPremium, isTrialActive, tier, loading: subLoading, trialEndsAt, expiresAt } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'YEARLY'>('YEARLY')
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponResult, setCouponResult] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (searchParams?.get('success') === 'true') {
      toast.success('Abonelik başarıyla aktif edildi! \u{1F389}')
    }
    if (searchParams?.get('cancelled') === 'true') {
      toast.info('Ödeme iptal edildi')
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
        toast.error(data.error || 'Ödeme başlatılamadı')
      }
    } catch {
      toast.error('Bir hata oluştu')
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
        toast.error(data.error || 'Portal açılamadı')
      }
    } catch {
      toast.error('Bir hata oluştu')
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
      setCouponResult({ valid: false, error: 'Bir hata oluştu' })
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
        toast.error(data.error || 'Kupon kullanılamadı')
      }
    } catch {
      toast.error('Bir hata oluştu')
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
        <h1 className="text-3xl font-bold">Planınızı Seçin</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          BIST Trade Premium ile teknik analiz, otomatik al/sat ve daha fazlasına erişin.
          7 gün ücretsiz deneyin!
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
                  {isTrialActive ? 'Deneme Süresi Aktif' : 'Premium Aktif'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isTrialActive && trialEndsAt
                    ? `Deneme ${formatDate(trialEndsAt)} tarihine kadar`
                    : expiresAt
                    ? `${formatDate(expiresAt)} tarihine kadar geçerli`
                    : 'Aktif abonelik'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
              Aboneliği Yönet
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
              Aylık
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedPlan === 'YEARLY' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setSelectedPlan('YEARLY')}
            >
              Yıllık
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
              <h3 className="text-xl font-bold">Ücretsiz</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">₺0</span>
                <span className="text-muted-foreground">/ay</span>
              </div>
              <p className="text-sm text-muted-foreground">Temel özelliklerle başlayın</p>
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
              <Star className="h-3 w-3 mr-1" /> Önerilen
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
                  {selectedPlan === 'MONTHLY' ? '₺49,90' : '₺499'}
                </span>
                <span className="text-muted-foreground">
                  /{selectedPlan === 'MONTHLY' ? 'ay' : 'yıl'}
                </span>
              </div>
              {selectedPlan === 'YEARLY' && (
                <p className="text-sm text-emerald-500 font-medium">₺41,58/ay - Aylık ödemeye göre %17 tasarruf!</p>
              )}
              <p className="text-sm text-muted-foreground">7 gün ücretsiz deneme ile başlayın</p>
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
                7 Gün Ücretsiz Dene
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
        <span>Güvenli ödeme Stripe altyapısı ile sağlanmaktadır</span>
      </div>
    </div>
  )
}

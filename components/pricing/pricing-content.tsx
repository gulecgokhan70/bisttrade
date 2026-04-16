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
  Smartphone,
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
  const { isPremium, isTrialActive, tier, loading: subLoading, trialEndsAt, expiresAt, daysRemaining } = useSubscription()
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponResult, setCouponResult] = useState<any>(null)

  useEffect(() => {
    if (searchParams?.get('success') === 'true') {
      toast.success('Abonelik başarıyla aktif edildi! \u{1F389}')
    }
  }, [searchParams])

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
      if (data.valid) {
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
    if (!session?.user) {
      router.push('/login')
      return
    }
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/coupon/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setCouponCode('')
        setCouponResult(null)
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

  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
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
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/subscription')}>
              <Settings className="h-4 w-4 mr-2" />
              Aboneliği Yönet
            </Button>
          </CardContent>
        </Card>
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
                <span className="text-3xl font-bold">₺49,90</span>
                <span className="text-muted-foreground">/ay</span>
              </div>
              <p className="text-sm text-emerald-500 font-medium">Yıllık ₺499 - Aylık ödemeye göre %17 tasarruf!</p>
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
              <div className="space-y-3 mt-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                    <span>Google Play Store üzerinden abone olabilirsiniz</span>
                  </div>
                </div>
              </div>
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
            <p className="text-sm text-muted-foreground mb-4">
              Kupon kodunuz varsa aşağıya girerek Premium üyeliğinizi aktifleştirebilirsiniz.
            </p>
            <div className="flex gap-3">
              <Input
                placeholder="Kupon kodunuzu girin"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                className="max-w-xs uppercase"
                onKeyDown={(e) => e.key === 'Enter' && (couponResult?.valid && couponResult?.discountPercent === 100 ? handleRedeemCoupon() : handleValidateCoupon())}
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
                    {couponResult.discountPercent === 100
                      ? `%100 indirim! “Kullan” butonuna tıklayın.`
                      : `%${couponResult.discountPercent} indirim!`}
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
        <span>Güvenli ödeme Google Play altyapısı ile sağlanmaktadır</span>
      </div>
    </div>
  )
}

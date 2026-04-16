'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Crown, Check, Zap, Shield, BarChart3, Bot,
  Radio, Bell, Ticket, Sparkles, Star, Smartphone
} from 'lucide-react';

const FREE_FEATURES = [
  { icon: BarChart3, text: 'Piyasa Listesi' },
  { icon: Shield, text: 'Temel Al/Sat' },
  { icon: Shield, text: 'Portföy Yönetimi' },
  { icon: Bell, text: '3 Alarm Hakkı' },
];

const PREMIUM_FEATURES = [
  { icon: BarChart3, text: 'Teknik Analiz' },
  { icon: Bot, text: 'Otomatik Al/Sat' },
  { icon: Radio, text: 'Balina Radarı' },
  { icon: Bell, text: 'Sınırsız Alarm' },
  { icon: Zap, text: 'Premium Sinyal' },
  { icon: Sparkles, text: 'Tüm Özellikler' },
];

export default function PricingContent() {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const { isPremium, tier, loading } = useSubscription();
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const handleCoupon = async () => {
    if (!session?.user) {
      toast.error('Önce giriş yapmalısınız');
      return;
    }
    if (!couponCode.trim()) {
      toast.error('Kupon kodu giriniz');
      return;
    }

    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupon/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCouponCode('');
        setTimeout(() => router.push('/dashboard/subscription'), 1500);
      } else {
        toast.error(data.error || 'Kupon uygulanamadı');
      }
    } catch {
      toast.error('Bir hata oluştu');
    } finally {
      setCouponLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
          <Crown className="h-4 w-4" />
          Premium Üyelik
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold">Yatırım Potansiyelinizi Açığa Çıkarın</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Premium özelliklerle daha akıllı yatırım kararları alın
        </p>
      </div>

      {isPremium && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
          <p className="text-emerald-400 font-medium flex items-center justify-center gap-2">
            <Crown className="h-5 w-5" />
            Zaten Premium üyesiniz!
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => router.push('/dashboard/subscription')}
          >
            Aboneliğimi Yönet
          </Button>
        </div>
      )}

      {/* Plans */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <Card className="border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Ücretsiz</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">₺0</span>
              <span className="text-muted-foreground"> / süresiz</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  {f.text}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>
              Mevcut Plan
            </Button>
          </CardContent>
        </Card>

        {/* Premium Plan */}
        <Card className="border-primary/50 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-3">
              <Star className="h-3 w-3 mr-1" /> Popüler
            </Badge>
          </div>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Premium</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">₺49<span className="text-2xl">,90</span></span>
              <span className="text-muted-foreground"> / ay</span>
            </div>
            <p className="text-xs text-emerald-400 mt-1">Yıllık ₺499 (17% tasarruf)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {PREMIUM_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f.text}
                </li>
              ))}
            </ul>
            {!isPremium && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span>Google Play Store üzerinden abone olun</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coupon Section */}
      {!isPremium && (
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <Ticket className="h-5 w-5 text-primary" />
                <span className="font-medium">Kupon Kodunuz Var Mı?</span>
              </div>
              <div className="flex flex-1 gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Kupon kodunu girin"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && handleCoupon()}
                />
                <Button
                  onClick={handleCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  variant="outline"
                >
                  {couponLoading ? 'Kontrol...' : 'Uygula'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

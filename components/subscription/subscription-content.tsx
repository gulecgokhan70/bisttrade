'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Crown, Calendar, Clock, ArrowRight, Shield, Smartphone
} from 'lucide-react';

export default function SubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPremium, tier, expiresAt, isTrialActive, trialEndsAt, daysRemaining, loading, refetch } = useSubscription();
  const success = searchParams.get('success');

  useEffect(() => {
    if (success === 'true') {
      toast.success('Ödeme başarılı! Premium üyeliğiniz aktif.');
      refetch();
    }
  }, [success, refetch]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Crown className={`h-6 w-6 ${isPremium ? 'text-yellow-500' : 'text-muted-foreground'}`} />
        <h1 className="text-2xl font-bold">Abonelik Yönetimi</h1>
      </div>

      {/* Current Status */}
      <Card className={isPremium ? 'border-primary/50 bg-primary/5' : 'border-border/50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mevcut Plan</CardTitle>
            <Badge variant={isPremium ? 'default' : 'secondary'}>
              {isPremium ? 'Premium' : 'Ücretsiz'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPremium ? (
            <div className="space-y-3">
              {isTrialActive && (
                <div className="flex items-center gap-2 text-sm text-yellow-400">
                  <Clock className="h-4 w-4" />
                  Deneme süresi aktif - {formatDate(trialEndsAt)} tarihinde sona eriyor
                </div>
              )}
              {!isTrialActive && expiresAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Geçerlilik: {formatDate(expiresAt)}
                </div>
              )}
              {daysRemaining !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  {daysRemaining >= 99000 ? (
                    <>Kalan süre: <strong>Süresiz Premium</strong></>
                  ) : (
                    <>Kalan süre: <strong>{daysRemaining} gün</strong></>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Ücretsiz planda sınırlı özelliklerle devam ediyorsunuz.
                Premium'a geçerek tüm özellikleri açın.
              </p>
              <Button
                onClick={() => router.push('/dashboard/pricing')}
                className="bg-primary hover:bg-primary/90"
              >
                <Crown className="h-4 w-4 mr-2" />
                Premium'a Geç
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Play Info */}
      {isPremium && !isTrialActive && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Ödeme Yönetimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Smartphone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Google Play üzerinden yönetin</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Aboneliğinizi Google Play Store uygulamasından yönetebilirsiniz.
                  Google Play → Abonelikler bölümünden plan değiştirme veya iptal işlemi yapabilirsiniz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Premium Özellikler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { title: 'Teknik Analiz', desc: 'RSI, MACD, Bollinger ve daha fazlası' },
              { title: 'Otomatik Al/Sat', desc: 'Strateji bazlı otomatik işlem' },
              { title: 'Balina Radarı', desc: 'Büyük hacimli işlemleri takip' },
              { title: 'Sınırsız Alarm', desc: 'Fiyat alarmı limiti yok' },
              { title: 'Premium Sinyal', desc: 'Gelişmiş al/sat sinyalleri' },
              { title: 'Öncelikli Destek', desc: 'Hızlı teknik destek' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

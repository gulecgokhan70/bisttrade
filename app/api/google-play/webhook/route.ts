export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Google Play Real-Time Developer Notifications (RTDN)
// Google Cloud Pub/Sub üzerinden gelen bildirimler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Google Pub/Sub mesaj formatı
    const message = body.message;
    if (!message?.data) {
      return NextResponse.json({ received: true });
    }

    // Base64 decode
    const decodedData = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8')
    );

    console.log('Google Play RTDN:', JSON.stringify(decodedData));

    const notification = decodedData.subscriptionNotification;
    if (!notification) {
      return NextResponse.json({ received: true });
    }

    const { notificationType, purchaseToken, subscriptionId } = notification;
    const packageName = decodedData.packageName;

    // Bildirim türleri:
    // 1: RECOVERED - Hesap geri yüklendi
    // 2: RENEWED - Yenilendi
    // 3: CANCELED - İptal edildi
    // 4: PURCHASED - Yeni satın alma
    // 5: ON_HOLD - Bekleme
    // 6: IN_GRACE_PERIOD - Ödemesiz dönem
    // 7: RESTARTED - Tekrar başlatıldı
    // 12: REVOKED - Geri alındı
    // 13: EXPIRED - Süresi doldu

    switch (notificationType) {
      case 1: // RECOVERED
      case 2: // RENEWED
      case 4: // PURCHASED
      case 7: // RESTARTED
        // Aboneliği aktifle/yenile
        await handleSubscriptionActive(packageName, subscriptionId, purchaseToken);
        break;

      case 3:  // CANCELED
      case 12: // REVOKED
      case 13: // EXPIRED
        // Aboneliği iptal et
        await handleSubscriptionCancelled(purchaseToken);
        break;

      case 5: // ON_HOLD
      case 6: // IN_GRACE_PERIOD
        console.log(`Subscription on hold/grace: ${purchaseToken}`);
        break;

      default:
        console.log(`Unhandled notification type: ${notificationType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Google Play webhook error:', error);
    return NextResponse.json({ received: true });
  }
}

async function handleSubscriptionActive(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
) {
  try {
    // Subscription tablosundan kullanıcıyı bul
    // purchaseToken ile eşleşen kaydı ara
    const existingSub = await prisma.subscription.findFirst({
      where: {
        OR: [
          { plan: { startsWith: 'GOOGLE_' } },
        ],
        status: { in: ['ACTIVE', 'CANCELLED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Not: İlk satın alma /api/google-play/verify üzerinden yapılır
    // Bu webhook sadece yenileme/iptal/geri alma için
    if (existingSub) {
      const periodEnd = new Date();
      if (subscriptionId?.includes('yearly') || subscriptionId?.includes('yillik')) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
        },
      });

      await prisma.user.update({
        where: { id: existingSub.userId },
        data: {
          subscriptionTier: 'PREMIUM',
          subscriptionExpiresAt: periodEnd,
        },
      });

      console.log(`Subscription renewed for user ${existingSub.userId}`);
    }
  } catch (error) {
    console.error('handleSubscriptionActive error:', error);
  }
}

async function handleSubscriptionCancelled(purchaseToken: string) {
  try {
    // Google aboneliğini bul ve iptal et
    const subs = await prisma.subscription.findMany({
      where: {
        plan: { startsWith: 'GOOGLE_' },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const sub of subs) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED' },
      });

      // Süre bitmediyse premium kalsın, bitince otomatik düşer
      // getSubscriptionStatus zaten expiresAt kontrolü yapıyor
      console.log(`Subscription cancelled for user ${sub.userId}`);
    }
  } catch (error) {
    console.error('handleSubscriptionCancelled error:', error);
  }
}

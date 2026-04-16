import { prisma } from '@/lib/prisma';

export type SubscriptionStatus = {
  isPremium: boolean;
  tier: string;
  expiresAt: Date | null;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
};

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
    },
  });

  if (!user) {
    return {
      isPremium: false,
      tier: 'FREE',
      expiresAt: null,
      isTrialActive: false,
      trialEndsAt: null,
      daysRemaining: null,
    };
  }

  const now = new Date();
  
  // Check trial
  const isTrialActive = user.trialEndsAt ? user.trialEndsAt > now : false;
  
  // Check subscription
  const isSubscriptionActive = user.subscriptionTier === 'PREMIUM' && 
    user.subscriptionExpiresAt ? user.subscriptionExpiresAt > now : false;
  
  const isPremium = isTrialActive || isSubscriptionActive;
  
  // Days remaining
  let daysRemaining: number | null = null;
  if (isSubscriptionActive && user.subscriptionExpiresAt) {
    daysRemaining = Math.ceil((user.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else if (isTrialActive && user.trialEndsAt) {
    daysRemaining = Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    isPremium,
    tier: isPremium ? 'PREMIUM' : 'FREE',
    expiresAt: user.subscriptionExpiresAt,
    isTrialActive,
    trialEndsAt: user.trialEndsAt,
    daysRemaining,
  };
}

export async function activateSubscription(
  userId: string,
  plan: string,
  periodEnd: Date,
  purchaseSource?: string,
  purchaseToken?: string
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'PREMIUM',
      subscriptionExpiresAt: periodEnd,
    },
  });

  await prisma.subscription.create({
    data: {
      userId,
      plan,
      status: 'ACTIVE',
      currentPeriodEnd: periodEnd,
      currentPeriodStart: new Date(),
    },
  });
}

export async function deactivateSubscription(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'FREE',
      },
    });
  }
}

export async function activateCoupon(userId: string, couponCode: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode.toUpperCase() },
  });

  if (!coupon) throw new Error('Geçersiz kupon kodu');
  if (!coupon.isActive) throw new Error('Bu kupon kodu artık geçerli değil');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error('Kupon kodunun süresi dolmuş');
  if (coupon.currentUses >= coupon.maxUses) throw new Error('Kupon kodu kullanım limiti dolmuş');

  // Check if user already used this coupon
  const existingUsage = await prisma.couponUsage.findUnique({
    where: { userId_couponId: { userId, couponId: coupon.id } },
  });
  if (existingUsage) throw new Error('Bu kupon kodunu zaten kullandınız');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + coupon.durationDays * 24 * 60 * 60 * 1000);

  // Activate subscription
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'PREMIUM',
      subscriptionExpiresAt: expiresAt,
    },
  });

  // Record coupon usage
  await prisma.couponUsage.create({
    data: { userId, couponId: coupon.id },
  });

  // Increment usage count
  await prisma.coupon.update({
    where: { id: coupon.id },
    data: { currentUses: { increment: 1 } },
  });

  // Create subscription record
  await prisma.subscription.create({
    data: {
      userId,
      plan: 'COUPON',
      status: 'ACTIVE',
      couponCode: coupon.code,
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
    },
  });

  return {
    durationDays: coupon.durationDays,
    discountPercent: coupon.discountPercent,
    expiresAt,
  };
}

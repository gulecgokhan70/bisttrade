import { prisma } from '@/lib/prisma'

export type SubscriptionTier = 'FREE' | 'PREMIUM'

export const PLANS = {
  MONTHLY: {
    name: 'Ayl\u0131k',
    price: 49.90,
    interval: 'month' as const,
    priceDisplay: '\u20BA49,90',
    badge: '',
  },
  YEARLY: {
    name: 'Y\u0131ll\u0131k',
    price: 499,
    interval: 'year' as const,
    priceDisplay: '\u20BA499',
    badge: '%17 Tasarruf',
    monthlyEquivalent: '\u20BA41,58/ay',
  },
} as const

export const FREE_FEATURES = [
  'Piyasa listesi',
  'Temel al/sat i\u015Flemleri',
  'Portf\u00F6y takibi',
  '\u0130zleme listesi',
  'Emir y\u00F6netimi',
  '3 fiyat alarm\u0131',
]

export const PREMIUM_FEATURES = [
  'T\u00FCm \u00FCcretsiz \u00F6zellikler',
  'Teknik analiz ara\u00E7lar\u0131',
  'Otomatik al/sat stratejileri',
  'Balina radar\u0131',
  'S\u0131n\u0131rs\u0131z fiyat alarm\u0131',
  '\u00D6ncelikli destek',
]

export const PREMIUM_PAGES = [
  '/dashboard/analysis',
  '/dashboard/auto-trade',
]

export const FREE_ALERT_LIMIT = 3

export async function getUserSubscription(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  })
  if (!user) return { tier: 'FREE' as SubscriptionTier, isPremium: false, isTrialing: false }

  const now = new Date()
  
  // Check trial
  if (user.trialEndsAt && user.trialEndsAt > now) {
    return { tier: 'PREMIUM' as SubscriptionTier, isPremium: true, isTrialing: true, trialEndsAt: user.trialEndsAt }
  }

  // Check active subscription
  if (user.subscriptionTier === 'PREMIUM' && user.subscriptionExpiresAt && user.subscriptionExpiresAt > now) {
    return { tier: 'PREMIUM' as SubscriptionTier, isPremium: true, isTrialing: false, expiresAt: user.subscriptionExpiresAt }
  }

  // Expired - downgrade
  if (user.subscriptionTier === 'PREMIUM' && user.subscriptionExpiresAt && user.subscriptionExpiresAt <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'FREE' },
    })
    return { tier: 'FREE' as SubscriptionTier, isPremium: false, isTrialing: false }
  }

  return { tier: (user.subscriptionTier as SubscriptionTier) || 'FREE', isPremium: user.subscriptionTier === 'PREMIUM', isTrialing: false }
}

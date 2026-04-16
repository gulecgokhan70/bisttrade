import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia' as any,
  typescript: true,
});

export const PLANS = {
  MONTHLY: {
    name: 'Aylık Premium',
    price: 4990, // kuруş cinsinden
    priceDisplay: '49,90',
    currency: 'try',
    interval: 'month' as const,
    features: [
      'Teknik Analiz',
      'Otomatik Al/Sat',
      'Balina Radarı',
      'Sınırsız Alarm',
      'Premium Sinyal',
    ],
  },
  YEARLY: {
    name: 'Yıllık Premium',
    price: 49900,
    priceDisplay: '499',
    currency: 'try',
    interval: 'year' as const,
    features: [
      'Teknik Analiz',
      'Otomatik Al/Sat',
      'Balina Radarı',
      'Sınırsız Alarm',
      'Premium Sinyal',
      '2 Ay Ücretsiz (Yıllık)',
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

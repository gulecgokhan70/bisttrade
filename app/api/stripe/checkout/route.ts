export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { stripe, PLANS } from '@/lib/stripe';
import type { PlanType } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const body = await request.json();
    const planKey = body.plan as PlanType;

    if (!planKey || !PLANS[planKey]) {
      return NextResponse.json({ error: 'Geçersiz plan' }, { status: 400 });
    }

    const plan = PLANS[planKey];
    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: user?.name || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: `BIST Trade ${plan.name}`,
              description: plan.features.join(', '),
            },
            unit_amount: plan.price,
            recurring: {
              interval: plan.interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/pricing?cancelled=true`,
      metadata: {
        userId: session.user.id,
        plan: planKey,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan: planKey,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Ödeme oturumu oluşturulamadı' },
      { status: 500 }
    );
  }
}

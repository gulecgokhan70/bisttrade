export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { activateSubscription, deactivateSubscription } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan || 'MONTHLY';

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const periodEnd = new Date((subscription as any).current_period_end * 1000);

          await activateSubscription(
            userId,
            plan,
            subscription.id,
            session.customer as string,
            periodEnd
          );
          console.log(`Subscription activated for user ${userId}, plan: ${plan}`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription as string;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const periodEnd = new Date((subscription as any).current_period_end * 1000);
          
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subId },
          });

          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'ACTIVE',
                currentPeriodEnd: periodEnd,
              },
            });

            await prisma.user.update({
              where: { id: sub.userId },
              data: {
                subscriptionTier: 'PREMIUM',
                subscriptionExpiresAt: periodEnd,
              },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await deactivateSubscription(subscription.id);
        console.log(`Subscription cancelled: ${subscription.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (sub) {
          const status = subscription.cancel_at_period_end ? 'CANCELLED' :
            subscription.status === 'active' ? 'ACTIVE' :
            subscription.status === 'past_due' ? 'PAST_DUE' : 'EXPIRED';

          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status,
              cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });

          if (subscription.status !== 'active' && !subscription.cancel_at_period_end) {
            await prisma.user.update({
              where: { id: sub.userId },
              data: { subscriptionTier: 'FREE' },
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription as string;
        if (subId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subId },
          });
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'PAST_DUE' },
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
  }

  return NextResponse.json({ received: true });
}

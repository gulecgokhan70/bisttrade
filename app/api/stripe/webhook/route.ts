export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // For testing without webhook secret
      event = JSON.parse(body)
      console.warn('No STRIPE_WEBHOOK_SECRET set, parsing body directly')
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId
        const plan = session.metadata?.plan || 'MONTHLY'
        
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const periodEnd = new Date((subscription as any).current_period_end * 1000)
          const periodStart = new Date((subscription as any).current_period_start * 1000)

          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: 'PREMIUM',
              subscriptionExpiresAt: periodEnd,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            },
          })

          await prisma.subscription.create({
            data: {
              userId,
              plan,
              status: 'ACTIVE',
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          })
          console.log(`Subscription activated for user ${userId}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          const periodEnd = new Date((subscription as any).current_period_end * 1000)
          
          // Find user by stripe subscription id
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: invoice.subscription as string },
          })
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionTier: 'PREMIUM',
                subscriptionExpiresAt: periodEnd,
              },
            })
            // Update subscription record
            const sub = await prisma.subscription.findFirst({
              where: { stripeSubscriptionId: invoice.subscription as string },
              orderBy: { createdAt: 'desc' },
            })
            if (sub) {
              await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                  status: 'ACTIVE',
                  currentPeriodEnd: periodEnd,
                },
              })
            }
            console.log(`Subscription renewed for user ${user.id}`)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionTier: 'FREE',
              stripeSubscriptionId: null,
            },
          })
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
            orderBy: { createdAt: 'desc' },
          })
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'CANCELLED' },
            })
          }
          console.log(`Subscription cancelled for user ${user.id}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })
        if (user) {
          const status = subscription.status === 'active' ? 'ACTIVE' : 
                         subscription.status === 'past_due' ? 'PAST_DUE' :
                         subscription.status === 'canceled' ? 'CANCELLED' : 'ACTIVE'
          const periodEnd = new Date(subscription.current_period_end * 1000)
          
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionTier: status === 'CANCELLED' ? 'FREE' : 'PREMIUM',
              subscriptionExpiresAt: periodEnd,
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        console.error(`Payment failed for invoice ${invoice.id}`)
        if (invoice.subscription) {
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: invoice.subscription as string },
          })
          if (user) {
            const sub = await prisma.subscription.findFirst({
              where: { stripeSubscriptionId: invoice.subscription as string },
              orderBy: { createdAt: 'desc' },
            })
            if (sub) {
              await prisma.subscription.update({
                where: { id: sub.id },
                data: { status: 'PAST_DUE' },
              })
            }
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

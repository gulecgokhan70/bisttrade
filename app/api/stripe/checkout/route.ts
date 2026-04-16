export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id || !(session?.user as any)?.email) {
      return NextResponse.json({ error: 'Giri\u015F yapman\u0131z gerekiyor' }, { status: 401 })
    }

    const { plan, couponCode } = await request.json()
    if (!plan || !['MONTHLY', 'YEARLY'].includes(plan)) {
      return NextResponse.json({ error: 'Ge\u00E7ersiz plan' }, { status: 400 })
    }

    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || ''

    // Find or create Stripe customer
    const user = await prisma.user.findUnique({ where: { id: (session?.user as any)?.id } })
    let customerId = user?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (session?.user as any)?.email,
        name: (session?.user as any)?.name || undefined,
        metadata: { userId: (session?.user as any)?.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: (session?.user as any)?.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create price on the fly (or use existing)
    const amount = plan === 'MONTHLY' ? 4990 : 49900 // in kurus (TRY cents)
    const interval = plan === 'MONTHLY' ? 'month' : 'year'

    const prices = await stripe.prices.list({
      lookup_keys: [`bist_trade_${plan.toLowerCase()}`],
      active: true,
    })

    let priceId: string
    if (prices.data.length > 0) {
      priceId = prices.data[0].id
    } else {
      // Create product and price
      let products = await stripe.products.list({ active: true })
      let product = products.data.find(p => p.metadata?.app === 'bist_trade')
      if (!product) {
        product = await stripe.products.create({
          name: 'BIST Trade Premium',
          description: 'BIST Trade Premium Abonelik',
          metadata: { app: 'bist_trade' },
        })
      }
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amount,
        currency: 'try',
        recurring: { interval: interval as 'month' | 'year' },
        lookup_key: `bist_trade_${plan.toLowerCase()}`,
      })
      priceId = price.id
    }

    // Build checkout session params
    const sessionParams: any = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/dashboard/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/pricing?cancelled=true`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: (session?.user as any)?.id, plan },
      },
      metadata: { userId: (session?.user as any)?.id, plan },
      allow_promotion_codes: true,
    }

    // Apply coupon if provided
    if (couponCode) {
      try {
        const stripeCoupons = await stripe.coupons.list({ limit: 100 })
        const matchingCoupon = stripeCoupons.data.find(
          c => c.name?.toLowerCase() === couponCode.toLowerCase() && c.valid
        )
        if (matchingCoupon) {
          sessionParams.discounts = [{ coupon: matchingCoupon.id }]
          delete sessionParams.allow_promotion_codes
        }
      } catch (e) {
        console.log('Stripe coupon lookup failed:', e)
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message || '\u00D6deme i\u015Flemi ba\u015Far\u0131s\u0131z' }, { status: 500 })
  }
}

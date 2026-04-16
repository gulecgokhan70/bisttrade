export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getUserSubscription } from '@/lib/subscription'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ tier: 'FREE', isPremium: false, isTrialing: false })
    }
    const sub = await getUserSubscription((session?.user as any)?.id)
    return NextResponse.json(sub)
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json({ tier: 'FREE', isPremium: false, isTrialing: false })
  }
}

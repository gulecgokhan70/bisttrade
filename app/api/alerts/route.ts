export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const guestId = searchParams?.get('guestId') ?? ''

    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alerts = await prisma.priceAlert.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(alerts ?? [])
  } catch (error: any) {
    console.error('Alerts API error:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { symbol, targetPrice, condition, guestId } = body ?? {}

    if (!symbol || !targetPrice || !condition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    // Check alert limit for free users
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true, trialEndsAt: true } })
    const now = new Date()
    const isPremium = user?.subscriptionTier === 'PREMIUM' || (user?.trialEndsAt && user.trialEndsAt > now)
    if (!isPremium) {
      const alertCount = await prisma.priceAlert.count({ where: { userId, isActive: true } })
      if (alertCount >= 3) {
        return NextResponse.json({ error: "Ücretsiz planda en fazla 3 alarm oluşturabilirsiniz. Premium'a yükseltin!" }, { status: 403 })
      }
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        stockId: stock.id,
        targetPrice: parseFloat(targetPrice),
        condition,
      },
      include: { stock: true },
    })

    return NextResponse.json(alert)
  } catch (error: any) {
    console.error('Create alert error:', error)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const alertId = searchParams?.get('id') ?? ''
    const guestId = searchParams?.get('guestId') ?? ''

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID required' }, { status: 400 })
    }

    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.priceAlert.deleteMany({
      where: { id: alertId, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete alert error:', error)
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 })
  }
}
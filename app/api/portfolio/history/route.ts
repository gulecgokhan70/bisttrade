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
    const days = parseInt(searchParams?.get('days') ?? '30', 10)

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

    const since = new Date()
    since.setDate(since.getDate() - Math.min(days, 365))

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: {
        userId,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        totalValue: true,
        cashBalance: true,
        timestamp: true,
      },
    })

    // Also get recent transactions for activity summary
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { stock: { select: { symbol: true, name: true } } },
    })

    return NextResponse.json({
      snapshots: snapshots.map((s: any) => ({
        totalValue: s.totalValue,
        cashBalance: s.cashBalance,
        investmentValue: s.totalValue - s.cashBalance,
        timestamp: s.timestamp.toISOString(),
      })),
      recentTransactions: transactions.map((t: any) => ({
        type: t.type,
        symbol: t.stock?.symbol,
        name: t.stock?.name,
        quantity: t.quantity,
        price: t.price,
        totalAmount: t.totalAmount,
        date: t.createdAt.toISOString(),
      })),
    })
  } catch (err: any) {
    console.error('Portfolio history error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

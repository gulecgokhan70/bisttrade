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
    const search = searchParams?.get('search') ?? ''
    const type = searchParams?.get('type') ?? ''
    const page = parseInt(searchParams?.get('page') ?? '1')
    const limit = parseInt(searchParams?.get('limit') ?? '20')

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

    let where: any = { userId }
    if (type && type !== 'ALL') {
      where.type = type
    }
    if (search) {
      where.stock = {
        OR: [
          { symbol: { contains: search.toUpperCase(), mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { stock: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions: transactions ?? [],
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    })
  } catch (error: any) {
    console.error('Transactions API error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET - Fetch user's orders
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const guestId = searchParams?.get('guestId') ?? ''
    const status = searchParams?.get('status') ?? ''

    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Yetkilendirme gerekli' }, { status: 401 })
    }

    const where: any = { userId }
    if (status) where.status = status

    const orders = await prisma.order.findMany({
      where,
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (error: any) {
    console.error('Orders API error:', error)
    return NextResponse.json({ error: 'Emirler alınamadı' }, { status: 500 })
  }
}

// DELETE - Cancel an order
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const orderId = searchParams?.get('id') ?? ''
    const guestId = searchParams?.get('guestId') ?? ''

    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Yetkilendirme gerekli' }, { status: 401 })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: 'PENDING' },
    })

    if (!order) {
      return NextResponse.json({ error: 'Emir bulunamadı' }, { status: 404 })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({ success: true, message: 'Emir iptal edildi' })
  } catch (error: any) {
    console.error('Cancel order error:', error)
    return NextResponse.json({ error: 'Emir iptal edilemedi' }, { status: 500 })
  }
}

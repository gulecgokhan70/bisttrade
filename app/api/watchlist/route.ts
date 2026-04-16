export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

function getUserId(session: any, req: NextRequest) {
  if (session?.user?.id) return session.user.id
  const guestId = req.headers.get('x-guest-id') || req.nextUrl.searchParams.get('guestId')
  return guestId || null
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = getUserId(session, req)
    if (!userId) return NextResponse.json([], { status: 200 })

    const items = await prisma.watchlist.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error('Watchlist GET error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = getUserId(session, req)
    if (!userId) return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })

    const { symbol } = await req.json()
    if (!symbol) return NextResponse.json({ error: 'Sembol gerekli' }, { status: 400 })

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })

    // Check if already in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: { userId_stockId: { userId, stockId: stock.id } },
    })

    if (existing) {
      // Remove from watchlist (toggle)
      await prisma.watchlist.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed', symbol })
    }

    // Add to watchlist
    const item = await prisma.watchlist.create({
      data: { userId, stockId: stock.id },
      include: { stock: true },
    })

    return NextResponse.json({ action: 'added', symbol, item })
  } catch (err) {
    console.error('Watchlist POST error:', err)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = getUserId(session, req)
    if (!userId) return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })

    const { symbol } = await req.json()
    if (!symbol) return NextResponse.json({ error: 'Sembol gerekli' }, { status: 400 })

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })

    await prisma.watchlist.deleteMany({
      where: { userId, stockId: stock.id },
    })

    return NextResponse.json({ action: 'removed', symbol })
  } catch (err) {
    console.error('Watchlist DELETE error:', err)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

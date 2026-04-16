export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const guestUser = await prisma.user.create({
      data: {
        isGuest: true,
        cashBalance: 100000,
      },
    })

    return NextResponse.json({ guestId: guestUser.id })
  } catch (error: any) {
    console.error('Guest creation error:', error)
    return NextResponse.json({ error: 'Misafir hesabı oluşturulamadı' }, { status: 500 })
  }
}

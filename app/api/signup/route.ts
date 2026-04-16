export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body ?? {}

    if (!email || !password) {
      return NextResponse.json({ error: 'Email ve şifre gerekli' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Bu email zaten kayıtlı' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    // 7 gun ucretsiz deneme suresi
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? undefined,
        password: hashedPassword,
        cashBalance: 100000,
        role: 'user',
        subscriptionTier: 'PREMIUM',
        trialEndsAt,
      },
    })

    return NextResponse.json({ id: user.id, email: user.email, name: user.name })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Kayıt başarısız oldu' }, { status: 500 })
  }
}
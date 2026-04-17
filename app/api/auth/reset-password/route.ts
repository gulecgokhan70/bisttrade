export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { token, email, password } = await request.json()

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Eksik bilgi' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Şifre en az 6 karakter olmalı' }, { status: 400 })
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email.toLowerCase().trim(),
        token,
      },
    })

    if (!verificationToken) {
      return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş bağlantı' }, { status: 400 })
    }

    // Check expiry
    if (new Date() > verificationToken.expires) {
      // Clean up expired token
      await prisma.verificationToken.deleteMany({
        where: { identifier: email.toLowerCase().trim(), token },
      })
      return NextResponse.json({ error: 'Bağlantının süresi dolmuş. Lütfen tekrar deneyin.' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    // Delete the used token
    await prisma.verificationToken.deleteMany({
      where: { identifier: email.toLowerCase().trim(), token },
    })

    return NextResponse.json({ success: true, message: 'Şifre başarıyla güncellendi' })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

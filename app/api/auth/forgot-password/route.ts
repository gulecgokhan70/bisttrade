export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'E-posta adresi gerekli' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'E-posta gönderildi' })
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email.toLowerCase().trim() },
    })

    // Save the token
    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase().trim(),
        token,
        expires,
      },
    })

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://bisttrade.com.tr'
    const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email.toLowerCase().trim())}`

    // Send email
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 0;">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">BIST Trade</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">Şifre Sıfırlama</p>
        </div>
        <div style="padding: 30px;">
          <p style="color: #cbd5e1; font-size: 16px;">Merhaba,</p>
          <p style="color: #94a3b8; font-size: 14px;">BIST Trade hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Şifremi Sıfırla</a>
          </div>
          <p style="color: #64748b; font-size: 12px;">Bu bağlantı 1 saat geçerlidir. Eğer bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 20px 0;" />
          <p style="color: #475569; font-size: 11px;">Buton çalışmıyorsa bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br/><a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a></p>
        </div>
      </div>
    `

    const appUrl = process.env.NEXTAUTH_URL || ''
    let senderDomain = 'mail.abacusai.app'
    try { senderDomain = new URL(appUrl).hostname } catch {}

    await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_IFRE_SFRLAMA,
        subject: 'BIST Trade - Şifre Sıfırlama',
        body: htmlBody,
        is_html: true,
        recipient_email: email.toLowerCase().trim(),
        sender_email: `noreply@${senderDomain}`,
        sender_alias: 'BIST Trade',
      }),
    })

    return NextResponse.json({ success: true, message: 'E-posta gönderildi' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

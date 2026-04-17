'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'

export function ForgotPasswordForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout title="E-posta Gönderildi" description="Şifre sıfırlama bağlantısı e-posta adresinize gönderildi">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>{email}</strong> adresine şifre sıfırlama bağlantısı gönderdik.
            Lütfen gelen kutunuzu kontrol edin.
          </p>
          <p className="text-xs text-muted-foreground">
            E-posta gelmedi mi? Spam klasörünü kontrol edin veya birkaç dakika bekleyin.
          </p>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => router.push('/login')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Giriş Sayfasına Dön
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Şifremi Unuttum" description="E-posta adresinize şifre sıfırlama bağlantısı göndereceğiz">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="E-posta adresinizi girin"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e?.target?.value ?? '')}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Şifrenizi hatırladınız mı?{' '}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-primary font-medium hover:underline"
          >
            Giriş Yap
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

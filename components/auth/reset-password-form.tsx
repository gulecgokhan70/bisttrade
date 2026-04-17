'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    setToken(searchParams.get('token') || '')
    setEmail(searchParams.get('email') || '')
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı')
      return
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor')
      return
    }

    if (!token || !email) {
      setError('Geçersiz bağlantı. Lütfen tekrar şifre sıfırlama talebinde bulunun.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
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

  if (!token || !email) {
    return (
      <AuthLayout title="Geçersiz Bağlantı" description="Bu şifre sıfırlama bağlantısı geçersiz">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">
            Geçersiz veya süresi dolmuş bir bağlantı kullanıyorsunuz. Lütfen tekrar şifre sıfırlama talebinde bulunun.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/forgot-password')}
          >
            Tekrar Dene
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout title="Şifre Güncellendi" description="Şifreniz başarıyla değiştirildi">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Şifreniz başarıyla güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz.
          </p>
          <Button
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Giriş Yap
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Yeni Şifre Belirle" description="Hesabınız için yeni bir şifre oluşturun">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">Yeni Şifre</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Yeni şifrenizi girin"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e?.target?.value ?? '')}
              className="pl-10 pr-10"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e?.target?.value ?? '')}
              className="pl-10"
              required
              minLength={6}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Güncelleniyor...' : 'Şifremi Güncelle'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Giriş Sayfasına Dön
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function SignupForm() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if ((password?.length ?? 0) < 6) {
      setError('Şifre en az 6 karakter olmalıdır')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      const data = await res?.json()

      if (!res?.ok) {
        setError(data?.error ?? 'Kayıt başarısız oldu')
        setLoading(false)
        return
      }

      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (result?.error) {
        setError('Hesap oluşturuldu ancak giriş başarısız. Lütfen giriş yapın.')
      } else {
        toast.success('BIST Trade\'e hoş geldiniz!')
        router.replace('/dashboard')
      }
    } catch (err: any) {
      setError('Bir hata oluştu')
      console.error('Signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Hesap Oluştur" description="₺100.000 sanal bakiye ile trade yapmaya başlayın">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Ad Soyad</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="Adınızı girin"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e?.target?.value ?? '')}
              className="pl-10"
              required
            />
          </div>
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Şifre</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="En az 6 karakter"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e?.target?.value ?? '')}
              className="pl-10 pr-10"
              required
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{' '}
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

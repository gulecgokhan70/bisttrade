'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import {
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  LineChart,
  Bell,
  ListOrdered,
  Users,
  Activity,
  Target,
  ChevronRight,
  Play,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'



export function LandingPageClient() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  const handleGuestDemo = async () => {
    try {
      const res = await fetch('/api/guest', { method: 'POST' })
      const data = await res?.json()
      if (data?.guestId) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tradex_guest_id', data.guestId)
        }
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Guest demo error:', err)
    }
  }



  if (!mounted) return null

  const features = [
    { icon: TrendingUp, title: 'Canlı BIST Verileri', description: 'BİST hisseleri için canlı fiyat takibi ve gerçek zamanlı güncellemeler.', color: 'from-blue-500 to-cyan-500' },
    { icon: BarChart3, title: 'Gelişmiş Grafikler', description: 'İnteraktif fiyat grafikleri, farklı zaman dilimleri ve teknik analiz.', color: 'from-violet-500 to-purple-500' },
    { icon: ListOrdered, title: 'Gelişmiş Emirler', description: 'Limit, Stop-Loss, Stop-Limit ve Takip Eden Stop emirleri ile işlem yapın.', color: 'from-orange-500 to-amber-500' },
    { icon: LineChart, title: 'Portföy Takibi', description: 'Hisse senetlerinizi, kar/zararınızı ve portföy performansınızı izleyin.', color: 'from-emerald-500 to-green-500' },
    { icon: Bell, title: 'Fiyat Alarmları', description: 'Hedef fiyatlar belirleyin, alarm tetiklendiğinde bilgilendirilini.', color: 'from-pink-500 to-rose-500' },
    { icon: Shield, title: 'Risksiz Öğrenme', description: '₺100.000 sanal bakiye ile gerçek piyasa koşullarında deneyim kazanın.', color: 'from-teal-500 to-cyan-500' },
  ]

  const steps = [
    { num: '01', title: 'Hesap Oluşturun', desc: 'Ücretsiz kayıt olun veya demo hesap ile hemen başlayın.', icon: Users },
    { num: '02', title: 'Analiz Yapın', desc: 'Teknik göstergeler ve AI sinyalleri ile hisse analizi yapın.', icon: Activity },
    { num: '03', title: 'Trade Yapın', desc: 'Gelişmiş emir türleri ile alım-satım yaparak deneyim kazanın.', icon: Target },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-display font-bold text-sm shadow-lg shadow-blue-500/20">
              BT
            </div>
            <span className="font-display font-bold text-lg tracking-tight">BIST Trade</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>
              Giriş Yap
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20" onClick={() => router.push('/signup')}>
              Kayıt Ol
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[10%] w-72 h-72 bg-blue-500/5 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute bottom-10 right-[15%] w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-float-slower" />
          <div className="absolute top-40 right-[25%] w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl animate-float-slow" />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-28 text-center relative z-10">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6 border border-primary/20">
              <Sparkles className="h-4 w-4" />
              BİST 100 Sanal Borsa Simülatörü
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 bg-clip-text text-transparent">BİST</span>{"'te"} Risk Almadan
              <br className="hidden sm:block" />
              <span className="relative">
                Trade Yapın
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 4 100 2 150 6C200 10 250 4 298 8" stroke="hsl(217 91% 60%)" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
                </svg>
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              ₺100.000 sanal bakiye ile BİST 100 hisselerinde gerçek zamanlı trade yapın.
              Gelişmiş emirler, portföy takibi ve teknik analiz — hiç risk almadan.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2 text-base bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-xl shadow-blue-500/25 h-12 px-8" onClick={() => router.push('/signup')}>
                Ücretsiz Hesap Oluştur <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 text-base h-12 px-8 border-2" onClick={handleGuestDemo}>
                <Play className="h-4 w-4" /> Demo Hesap Dene
              </Button>
            </div>
          </FadeIn>

          {/* Mini stats under hero */}
          <FadeIn delay={0.5}>
            <div className="flex items-center justify-center gap-8 sm:gap-12 mt-14 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Ücretsiz</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Gerçek Veriler</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Risk Yok</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>



      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-primary mb-2">NASIL ÇALIŞIR?</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                3 Adımda Başlayın
              </h2>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const StepIcon = step.icon
              return (
                <SlideIn key={step.num} from="bottom" delay={i * 0.12}>
                  <div className="relative text-center group">
                    {/* Connector line */}
                    {i < 2 && (
                      <div className="hidden sm:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-primary/20" />
                    )}
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center mb-5 group-hover:shadow-lg group-hover:shadow-primary/10 transition-all duration-300">
                      <StepIcon className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-primary/60 font-mono mb-2">{step.num}</p>
                    <h3 className="font-display font-bold text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </SlideIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-primary mb-2">ÖZELLİKLER</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Profesyonel Trade Deneyimi
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Gerçek borsa koşullarında, gelişmiş emir türleri ile deneyim kazanın.
              </p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat: any, i: number) => {
              const Icon = feat?.icon
              return (
                <SlideIn key={feat?.title ?? i} from="bottom" delay={i * 0.08}>
                  <Card className="bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group border-0 shadow-md">
                    <CardContent className="pt-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="font-display font-semibold text-lg mb-2">{feat?.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feat?.description}</p>
                    </CardContent>
                  </Card>
                </SlideIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeIn>
            <p className="text-sm font-medium text-primary mb-2">KULLANICI YORUMLARI</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-12">
              Kullanıcılarımız Ne Diyor?
            </h2>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: 'Ahmet K.', role: 'Yatırımcı', text: 'Gerçek piyasa verisi ile risk almadan trade öğrendim. Teknik analiz araçları harika!', stars: 5 },
              { name: 'Elif S.', role: 'Öğrenci', text: 'Demo hesap ile başladım, şimdi kendi portföyümü yönetiyorum. Çok eğitici bir platform.', stars: 5 },
              { name: 'Murat D.', role: 'Analist', text: 'Gelişmiş emir türleri ve AI destekli analiz özellikleri gerçekten profesyonel.', stars: 5 },
            ].map((review, i) => (
              <SlideIn key={review.name} from="bottom" delay={i * 0.1}>
                <Card className="text-left border-0 shadow-md hover:shadow-xl transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(review.stars)].map((_, j) => (
                        <svg key={j} className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">&ldquo;{review.text}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{review.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{review.name}</p>
                        <p className="text-xs text-muted-foreground">{review.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SlideIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-cyan-500/5" />
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" /> Hemen Başlayın
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Trade Kariyerinize{' '}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{"Bugün Başlayın"}</span>
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Kayıt olmadan demo hesap ile deneyebilir veya ücretsiz hesap oluşturabilirsiniz.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2 h-12 px-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-xl shadow-blue-500/25" onClick={() => router.push('/signup')}>
                Kayıt Ol <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 border-2" onClick={handleGuestDemo}>
                Demo Hesap
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t pt-8 pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-display font-bold text-xs">
                BT
              </div>
              <span className="text-sm text-muted-foreground">BIST Trade — Sanal Borsa Simülatörü</span>
            </div>
            <p className="text-xs text-muted-foreground">Tüm işlemler sanal olup gerçek para kullanılmamaktadır.</p>
          </div>

          {/* Yasal Uyarı */}
          <div className="border-t pt-5">
            <div className="bg-muted/40 rounded-lg p-4 space-y-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground/80 font-medium">
                ⚖️ Yasal Uyarı
              </p>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                BIST Trade, tamamen <strong className="text-muted-foreground/90">eğitim ve simülasyon amaçlı</strong> geliştirilmiş bir sanal borsa uygulamasıdır.
                Bu platformda gerçekleştirilen tüm alım-satım işlemleri sanal olup gerçek para veya finansal varlık kullanılmamaktadır.
                Uygulama içerisinde sunulan veriler, analizler, sinyaller ve öneriler hiçbir şekilde <strong className="text-muted-foreground/90">yatırım danışmanlığı veya yatırım tavsiyesi</strong> niteliği taşımamaktadır.
              </p>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                Sermaye Piyasası Kurulu (SPK) düzenlemeleri gereğince, yatırım danışmanlığı hizmeti ancak yetkili kuruluşlar tarafından kişilerin risk ve getiri tercihleri dikkate alınarak verilebilir.
                Bu uygulamadaki içerikler genel bilgilendirme amacı taşır ve herhangi bir menkul kıymetin alım-satımını özendirecek şekilde yorumlanamaz.
                Gerçek yatırım kararlarınız için mutlaka lisanslı bir yatırım danışmanına başvurunuz.
              </p>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                Fiyat verileri üçüncü parti kaynaklardan sağlanmakta olup 15 dakikaya kadar gecikme içerebilir.
                Verilerin doğruluğu ve güncelliği konusunda herhangi bir garanti verilmemektedir.
                BIST Trade, bu verilere dayanılarak yapılabilecek herhangi bir gerçek yatırım işleminden doğacak zararlardan sorumlu tutulamaz.
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                © {new Date().getFullYear()} BIST Trade. Tüm hakları saklıdır. Bu uygulama Borsa İstanbul A.Ş. ile herhangi bir resmi bağlantıya sahip değildir.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
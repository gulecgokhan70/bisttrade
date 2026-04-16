'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  TrendingUp,
  BarChart3,
  Bot,
  Shield,
  Zap,
  Target,
  Users,
  Smartphone,
  Globe,
  Bell,
  LineChart,
  Wallet,
  ArrowRight,
} from 'lucide-react'

const SLIDES = [
  // 0 - Hero
  {
    id: 'hero',
    bg: 'https://cdn.abacus.ai/images/0335830b-8346-43ee-a5f1-157e8ec4433d.png',
  },
  // 1 - Problem
  { id: 'problem' },
  // 2 - Solution
  { id: 'solution' },
  // 3 - Real-time data
  {
    id: 'realtime',
    bg: 'https://cdn.abacus.ai/images/cacc66a3-3a64-47a2-8b4a-c9ff8593714e.png',
  },
  // 4 - Trading
  {
    id: 'trading',
    bg: 'https://cdn.abacus.ai/images/c663a475-4c3f-40be-ab9b-8210f25348ad.png',
  },
  // 5 - Portfolio
  {
    id: 'portfolio',
    bg: 'https://cdn.abacus.ai/images/ec177d61-df28-4b3d-93ce-89118c530355.png',
  },
  // 6 - Auto-trade
  {
    id: 'autotrade',
    bg: 'https://cdn.abacus.ai/images/088730fc-ea94-40df-98dd-d7bd38c92c0b.png',
  },
  // 7 - Features grid
  { id: 'features' },
  // 8 - Stats
  { id: 'stats' },
  // 9 - CTA
  { id: 'cta' },
]

export function PresentationClient() {
  const [current, setCurrent] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  const goTo = useCallback((idx: number) => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrent(idx)
    setTimeout(() => setIsAnimating(false), 500)
  }, [isAnimating])

  const next = useCallback(() => {
    goTo(current < SLIDES.length - 1 ? current + 1 : 0)
  }, [current, goTo])

  const prev = useCallback(() => {
    goTo(current > 0 ? current - 1 : SLIDES.length - 1)
  }, [current, goTo])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      if (e.key === 'Escape') router.push('/dashboard')
      if (e.key === 'f' || e.key === 'F') {
        document.documentElement.requestFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, router])

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return
    const timer = setInterval(next, 6000)
    return () => clearInterval(timer)
  }, [autoPlay, next])

  if (!mounted) return null

  const slide = SLIDES[current]

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] text-white overflow-hidden select-none" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      {/* Slide content */}
      <div className="relative w-full h-full">
        <div
          key={current}
          className="absolute inset-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]"
        >
          {slide.id === 'hero' && <HeroSlide bg={slide.bg!} />}
          {slide.id === 'problem' && <ProblemSlide />}
          {slide.id === 'solution' && <SolutionSlide />}
          {slide.id === 'realtime' && <RealtimeSlide bg={slide.bg!} />}
          {slide.id === 'trading' && <TradingSlide bg={slide.bg!} />}
          {slide.id === 'portfolio' && <PortfolioSlide bg={slide.bg!} />}
          {slide.id === 'autotrade' && <AutoTradeSlide bg={slide.bg!} />}
          {slide.id === 'features' && <FeaturesSlide />}
          {slide.id === 'stats' && <StatsSlide />}
          {slide.id === 'cta' && <CTASlide />}
        </div>
      </div>

      {/* Navigation bar */}
      <div className="absolute bottom-0 left-0 right-0 z-50">
        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button onClick={prev} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {autoPlay ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={next} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Slide dots */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? 'w-8 bg-emerald-500' : 'w-2 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50 font-mono">
              {current + 1}/{SLIDES.length}
            </span>
            <button
              onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide animation styles */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stagger-1 { animation: countUp 0.5s 0.1s ease-out both; }
        .stagger-2 { animation: countUp 0.5s 0.2s ease-out both; }
        .stagger-3 { animation: countUp 0.5s 0.3s ease-out both; }
        .stagger-4 { animation: countUp 0.5s 0.4s ease-out both; }
        .stagger-5 { animation: countUp 0.5s 0.5s ease-out both; }
        .stagger-6 { animation: countUp 0.5s 0.6s ease-out both; }
      `}</style>
    </div>
  )
}

/* ───── SLIDE COMPONENTS ───── */

function SlideBackground({ src, overlay = 0.6 }: { src: string; overlay?: number }) {
  return (
    <>
      <div className="absolute inset-0">
        <Image src={src} alt="" fill className="object-cover" priority />
      </div>
      <div className="absolute inset-0" style={{ background: `rgba(10, 14, 26, ${overlay})` }} />
    </>
  )
}

function HeroSlide({ bg }: { bg: string }) {
  return (
    <div className="relative w-full h-full flex items-center">
      <SlideBackground src={bg} overlay={0.65} />
      <div className="relative z-10 px-8 sm:px-16 lg:px-24 max-w-3xl">
        <div className="stagger-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium mb-6">
            <TrendingUp className="w-4 h-4" />
            Borsa İstanbul Simülatörü
          </div>
        </div>
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-6 stagger-2">
          BIST<br />
          <span className="text-emerald-400">Trade</span>
        </h1>
        <p className="text-xl sm:text-2xl text-white/70 leading-relaxed mb-8 stagger-3">
          Risksiz ortamda borsa deneyimi.<br />
          Gerçek piyasa verileri, sanal para.
        </p>
        <div className="flex items-center gap-4 stagger-4">
          <div className="flex items-center gap-2 text-white/50">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span>634+ BIST Hissesi</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-2 text-white/50">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span>Canlı Veri</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-2 text-white/50">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>%100 Ücretsiz</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProblemSlide() {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-[#111827] to-[#0a0e1a]">
      <div className="max-w-4xl px-8 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-4 stagger-1">SORUN</p>
        <h2 className="text-4xl sm:text-6xl font-bold mb-12 stagger-2">
          Borsaya başlamak<br />neden bu kadar <span className="text-red-400">zor</span>?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 stagger-3">
          {[
            { icon: '💸', title: 'Para Kaybetme Korkusu', desc: 'Yeni yatırımcılar deneyimsizlikten büyük kayıplar yaşıyor' },
            { icon: '📚', title: 'Karmaşık Araçlar', desc: 'Profesyonel platformlar yeni başlayanlar için çok karmaşık' },
            { icon: '⏱️', title: 'Pratik Eksikliği', desc: 'Teorik bilgi yeterli değil, gerçek piyasa deneyimi şart' },
          ].map((item, i) => (
            <div key={i} className={`p-6 rounded-2xl bg-white/5 border border-white/10 stagger-${i + 3}`}>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SolutionSlide() {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-emerald-950/20 to-[#0a0e1a]">
      <div className="max-w-4xl px-8 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-4 stagger-1">ÇÖZÜM</p>
        <h2 className="text-4xl sm:text-6xl font-bold mb-8 stagger-2">
          <span className="text-emerald-400">BIST Trade</span> ile<br />
          risk almadan öğrenin
        </h2>
        <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto stagger-3">
          ₺100.000 sanal para ile gerçek piyasa koşullarında<br />
          borsa deneyimi yaşayın. Kayıp yok, sadece öğrenme var.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-4">
          {[
            { icon: <LineChart className="w-8 h-8" />, label: 'Gerçek Grafikler' },
            { icon: <Target className="w-8 h-8" />, label: 'Gerçek Fiyatlar' },
            { icon: <Bot className="w-8 h-8" />, label: 'Oto Al/Sat' },
            { icon: <Bell className="w-8 h-8" />, label: 'Fiyat Alarmları' },
          ].map((item, i) => (
            <div key={i} className={`flex flex-col items-center gap-3 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 stagger-${i + 3}`}>
              <div className="text-emerald-400">{item.icon}</div>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RealtimeSlide({ bg }: { bg: string }) {
  return (
    <div className="relative w-full h-full flex items-center">
      <SlideBackground src={bg} overlay={0.7} />
      <div className="relative z-10 px-8 sm:px-16 lg:px-24 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6 stagger-1">
          <Zap className="w-3.5 h-3.5" /> ÖZELLİK #1
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold mb-6 stagger-2">
          Canlı Piyasa<br /><span className="text-emerald-400">Verileri</span>
        </h2>
        <ul className="space-y-4 stagger-3">
          {[
            'Yahoo Finance ile anlık fiyat güncellemeleri',
            '634+ BIST hissesi için 5 saniyede bir yenileme',
            'Gün içi, haftalık, aylık ve yıllık grafikler',
            'Mum ve alan grafik türleri',
            'Döviz kurları (USD, EUR, GBP, Altın)',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2.5 shrink-0" />
              <span className="text-white/80 text-lg">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function TradingSlide({ bg }: { bg: string }) {
  return (
    <div className="relative w-full h-full flex items-center">
      <SlideBackground src={bg} overlay={0.7} />
      <div className="relative z-10 px-8 sm:px-16 lg:px-24 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6 stagger-1">
          <BarChart3 className="w-3.5 h-3.5" /> ÖZELLİK #2
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold mb-6 stagger-2">
          Gelişmiş<br /><span className="text-emerald-400">İşlem Emirleri</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-3">
          {[
            { title: 'Piyasa Emri', desc: 'Anlık al/sat işlemleri' },
            { title: 'Limit Emir', desc: 'Belirlediğiniz fiyattan işlem' },
            { title: 'Stop Loss', desc: 'Kayıp sınırlama emri' },
            { title: 'Trailing Stop', desc: 'Dinamik takip emri' },
          ].map((item, i) => (
            <div key={i} className={`p-4 rounded-xl bg-white/5 border border-white/10 stagger-${i + 3}`}>
              <h3 className="font-semibold text-emerald-400 mb-1">{item.title}</h3>
              <p className="text-sm text-white/50">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PortfolioSlide({ bg }: { bg: string }) {
  return (
    <div className="relative w-full h-full flex items-center">
      <SlideBackground src={bg} overlay={0.7} />
      <div className="relative z-10 px-8 sm:px-16 lg:px-24 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6 stagger-1">
          <Wallet className="w-3.5 h-3.5" /> ÖZELLİK #3
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold mb-6 stagger-2">
          Portföy<br /><span className="text-emerald-400">Yönetimi</span>
        </h2>
        <ul className="space-y-4 stagger-3">
          {[
            '₺100.000 başlangıç sanal sermayesi',
            'Anlık kar/zarar takibi',
            'Portföy dağılım grafiği',
            'Detaylı işlem geçmişi ve raporlama',
            'Hisse bazlı performans analizi',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2.5 shrink-0" />
              <span className="text-white/80 text-lg">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function AutoTradeSlide({ bg }: { bg: string }) {
  return (
    <div className="relative w-full h-full flex items-center">
      <SlideBackground src={bg} overlay={0.7} />
      <div className="relative z-10 px-8 sm:px-16 lg:px-24 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6 stagger-1">
          <Bot className="w-3.5 h-3.5" /> ÖZELLİK #4
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold mb-6 stagger-2">
          Otomatik<br /><span className="text-emerald-400">Al/Sat Stratejileri</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-3">
          {[
            { title: 'SMA Crossover', desc: 'Hareketli ortalama kesişim stratejisi' },
            { title: 'RSI Stratejisi', desc: 'Aşırı alım/satım sinyalleri' },
            { title: 'MACD Stratejisi', desc: 'Momentum tabanlı al/sat' },
            { title: 'Bollinger Bantları', desc: 'Volatilite bazlı işlem' },
          ].map((item, i) => (
            <div key={i} className={`p-4 rounded-xl bg-white/5 border border-white/10 stagger-${i + 3}`}>
              <h3 className="font-semibold text-emerald-400 mb-1">{item.title}</h3>
              <p className="text-sm text-white/50">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeaturesSlide() {
  const features = [
    { icon: <TrendingUp className="w-6 h-6" />, title: 'Canlı Veriler', desc: 'Yahoo Finance entegrasyonu' },
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Teknik Analiz', desc: 'RSI, MACD, Bollinger' },
    { icon: <Bot className="w-6 h-6" />, title: 'Oto Al/Sat', desc: '4 farklı strateji' },
    { icon: <Bell className="w-6 h-6" />, title: 'Fiyat Alarmları', desc: 'Anlık bildirimler' },
    { icon: <Smartphone className="w-6 h-6" />, title: 'Mobil Uyumlu', desc: 'Her cihazda çalışır' },
    { icon: <Shield className="w-6 h-6" />, title: 'Güvenli', desc: 'Risk yok, sanal para' },
    { icon: <Users className="w-6 h-6" />, title: 'Misafir Modu', desc: 'Kayıt olmadan deneyin' },
    { icon: <Globe className="w-6 h-6" />, title: 'Döviz Takibi', desc: 'USD, EUR, Altın' },
  ]

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-[#111827] to-[#0a0e1a]">
      <div className="max-w-5xl px-8 w-full">
        <div className="text-center mb-10">
          <p className="text-emerald-400 font-semibold text-lg mb-3 stagger-1">TÜM ÖZELLİKLER</p>
          <h2 className="text-4xl sm:text-5xl font-bold stagger-2">
            Her Şey <span className="text-emerald-400">Tek Platformda</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className={`flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-colors stagger-${Math.min(i + 1, 6)}`}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                {f.icon}
              </div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-white/40">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatsSlide() {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-emerald-950/20 to-[#0a0e1a]">
      <div className="max-w-5xl px-8 w-full">
        <div className="text-center mb-12">
          <p className="text-emerald-400 font-semibold text-lg mb-3 stagger-1">RAKAMLARLA</p>
          <h2 className="text-4xl sm:text-5xl font-bold stagger-2">
            BIST Trade <span className="text-emerald-400">Platform</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '634+', label: 'BIST Hissesi', color: 'text-emerald-400' },
            { value: '5sn', label: 'Veri Yenileme', color: 'text-blue-400' },
            { value: '₺100K', label: 'Başlangıç Sermayesi', color: 'text-amber-400' },
            { value: '5', label: 'Emir Türü', color: 'text-purple-400' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`text-center p-6 rounded-2xl bg-white/[0.03] border border-white/10 stagger-${i + 2}`}
            >
              <div className={`text-4xl sm:text-5xl font-bold mb-2 ${stat.color}`}>{stat.value}</div>
              <div className="text-white/50 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CTASlide() {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-emerald-950/30 to-[#0a0e1a]">
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
      <div className="relative z-10 max-w-3xl px-8 text-center">
        <h2 className="text-5xl sm:text-7xl font-bold mb-6 stagger-1">
          Hemen<br /><span className="text-emerald-400">Başlayın</span>
        </h2>
        <p className="text-xl text-white/60 mb-10 stagger-2">
          Kayıt olmadan, ücretsiz olarak BIST hisselerini<br />
          sanal para ile alıp satmaya başlayın.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 stagger-3">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-lg transition-colors"
          >
            Ücretsiz Hesap Oluştur
            <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-lg transition-colors"
          >
            Misafir Olarak Dene
          </a>
        </div>
        <p className="text-white/30 text-sm mt-8 stagger-4">
          bisttrade.abacusai.app
        </p>
      </div>
    </div>
  )
}

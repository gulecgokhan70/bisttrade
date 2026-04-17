'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Lightbulb, TrendingUp, ShieldCheck, BarChart3, Wallet } from 'lucide-react'

const GUIDE_DISMISSED_KEY = 'bist_guide_dismissed'

const tips = [
  {
    icon: Wallet,
    title: 'Sanal Sermaye',
    description: 'Başlangıçta ₺100.000 sanal sermayeniz var. Gerçek para riski olmadan hisse alıp satabilirsiniz.',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    icon: BarChart3,
    title: 'Hisse Seçin',
    description: '"Hisse Listesi" sayfasından bir hisse seçin. Fiyat grafigi ve detayları görmek için üzerine tıklayın.',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Alım Yapın',
    description: 'Hisse sayfasında "Alım" sekmesinden miktar girin ve "Al" butonuna basın. Piyasa emri anında gerçekleşir.',
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Sinyalleri Takip Edin',
    description: 'Fırsat Tarayıcı size AL/SAT sinyalleri verir. Yeşil = alım fırsatı, Kırmızı = dikkat.',
    color: 'text-purple-500 bg-purple-500/10',
  },
]

export function BeginnerGuide() {
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash

  useEffect(() => {
    const val = localStorage.getItem(GUIDE_DISMISSED_KEY)
    setDismissed(val === 'true')
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(GUIDE_DISMISSED_KEY, 'true')
  }

  if (dismissed) return null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Nasıl Başlanır?</h3>
              <p className="text-[10px] text-muted-foreground">BİST simülatörü rehberi</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tips.map((tip, i) => {
            const Icon = tip.icon
            return (
              <div key={i} className="p-2.5 rounded-lg bg-card border border-border/50">
                <div className={`w-7 h-7 rounded-lg ${tip.color} flex items-center justify-center mb-1.5`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-semibold text-card-foreground mb-0.5">{tip.title}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{tip.description}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoTooltipProps {
  term: string
  explanation?: string
  className?: string
}

const TERM_EXPLANATIONS: Record<string, string> = {
  'RSI': 'Göreceli Güç Endeksi. 0-100 arası bir değer. 30 altı = aşırı satım (alım fırsatı), 70 üstü = aşırı alım (satım sinyali).',
  'MACD': 'Hareketli Ortalama Yakınsama/Iraksama. Trend yönü ve momentum göstergesi. Sinyal çizgisininin üstüne geçerse alım, altına geçerse satım sinyali.',
  'Bollinger': 'Fiyatın normal hareket bandını gösterir. Alt banda yakın = ucuz, üst banda yakın = pahalı. Sıkışma = büyük hareket beklentisi.',
  'SMA': 'Basit Hareketli Ortalama. Belirli dönemin ortalama fiyatı. Fiyat SMA üstünde = yükseliş trendi.',
  'EMA': 'Üssel Hareketli Ortalama. Son fiyatlara daha fazla ağırlık verir. Daha hızlı tepki verir.',
  'Golden Cross': 'Kısa vadeli ortalama uzun vadeliyi yukarı kestiğinde oluşur. Güçlü alım sinyali.',
  'Death Cross': 'Kısa vadeli ortalama uzun vadeliyi aşağı kestiğinde oluşur. Güçlü satım sinyali.',
  'Hacim': 'İşlem miktarı. Yüksek hacim = güçlü ilgi. Fiyat artışı + yüksek hacim = güçlü yükseliş.',
  'Destek': 'Fiyatın düşmeyi durdurduğu seviye. Alıcıların yoğunlaştığı nokta.',
  'Direnç': 'Fiyatın yükselmeyi durdurduğu seviye. Satıcıların yoğunlaştığı nokta.',
  'Volatilite': 'Fiyatın ne kadar dalgalandığını ölçer. Yüksek volatilite = yüksek risk ve fırsat.',
  'Takas': 'Hisse senedi el değiştirme verisi. Kurumsal ve bireysel yatırımcı akışını gösterir.',
  'Balina': 'Büyük hacimli işlem yapan yatırımcılar. Balinanın girdiği hissede büyük hareket beklenir.',
  'Piyasa Emri': 'Mevcut fiyattan hemen alım/satım yapar. En hızlı işlem türü.',
  'Limit Emri': 'Belirlediğiniz fiyata gelince otomatik işlem yapar. Daha kontrollü.',
  'Stop-Loss': 'Zarar durdurma emri. Fiyat belirlediğiniz seviyeye düşünce otomatik satar.',
}

export function InfoTooltip({ term, explanation, className }: InfoTooltipProps) {
  const [show, setShow] = useState(false)
  const text = explanation || TERM_EXPLANATIONS[term] || ''

  if (!text) return null

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted hover:bg-muted/80 transition-colors ml-0.5"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show) }}
        aria-label={`${term} nedir?`}
      >
        <Info className="h-2.5 w-2.5 text-muted-foreground" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg bg-popover border border-border shadow-lg text-xs text-popover-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-1">{term}</p>
          <p className="text-muted-foreground">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-r border-b border-border rotate-45 -mt-1" />
        </div>
      )}
    </span>
  )
}

export function getTermExplanation(term: string): string {
  return TERM_EXPLANATIONS[term] || ''
}

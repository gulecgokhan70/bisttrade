'use client'

import { AnalysisContent } from '@/components/analysis/analysis-content'
import { PremiumGate } from '@/components/premium-gate'

export default function AnalysisPage() {
  return (
    <PremiumGate feature="Teknik Analiz">
      <AnalysisContent />
    </PremiumGate>
  )
}

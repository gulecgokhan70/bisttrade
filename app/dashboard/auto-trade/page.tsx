'use client'

import { AutoTradeContent } from '@/components/auto-trade/auto-trade-content'
import { PremiumGate } from '@/components/premium-gate'

export default function AutoTradePage() {
  return (
    <PremiumGate feature="Otomatik Al/Sat">
      <AutoTradeContent />
    </PremiumGate>
  )
}

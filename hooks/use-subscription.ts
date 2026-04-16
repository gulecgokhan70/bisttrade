'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface SubscriptionData {
  tier: 'FREE' | 'PREMIUM'
  isPremium: boolean
  isTrialing: boolean
  trialEndsAt?: string
  expiresAt?: string
  loading: boolean
}

export function useSubscription(): SubscriptionData {
  const { data: session, status } = useSession() || {}
  const [data, setData] = useState<SubscriptionData>({
    tier: 'FREE',
    isPremium: false,
    isTrialing: false,
    loading: true,
  })

  const fetchSubscription = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) {
      setData(prev => ({ ...prev, loading: false }))
      return
    }
    try {
      const res = await fetch('/api/subscription/status')
      if (res.ok) {
        const json = await res.json()
        setData({ ...json, loading: false })
      } else {
        setData(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setData(prev => ({ ...prev, loading: false }))
    }
  }, [status, session])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  return data
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface SubscriptionInfo {
  isPremium: boolean;
  tier: string;
  expiresAt: string | null;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  loading: boolean;
}

export function useSubscription() {
  const { data: session, status } = useSession() || {};
  const [info, setInfo] = useState<SubscriptionInfo>({
    isPremium: false,
    tier: 'FREE',
    expiresAt: null,
    isTrialActive: false,
    trialEndsAt: null,
    daysRemaining: null,
    loading: true,
  });

  const fetchSubscription = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setInfo(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const res = await fetch('/api/subscription/status');
      if (res.ok) {
        const data = await res.json();
        setInfo({ ...data, loading: false });
      } else {
        setInfo(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setInfo(prev => ({ ...prev, loading: false }));
    }
  }, [status, session?.user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return { ...info, refetch: fetchSubscription };
}

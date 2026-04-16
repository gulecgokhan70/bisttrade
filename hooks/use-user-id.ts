'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

export function useUserId() {
  const { data: session, status } = useSession() || {}
  const [guestId, setGuestId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated' && typeof window !== 'undefined') {
      const id = localStorage.getItem('tradex_guest_id')
      setGuestId(id)
    }
  }, [status])

  const userId = (session?.user as any)?.id ?? null
  const isGuest = !userId && !!guestId
  const effectiveId = userId ?? guestId

  return { userId: effectiveId, isGuest, isAuthenticated: !!userId, guestId, status }
}

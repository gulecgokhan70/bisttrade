// Guest session management using localStorage
const GUEST_KEY = 'tradex_guest_id'

export function getGuestId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(GUEST_KEY)
}

export function setGuestId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(GUEST_KEY, id)
}

export function clearGuestId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(GUEST_KEY)
}

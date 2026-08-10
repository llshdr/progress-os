'use client'

import { useEffect, useState } from 'react'

// navigator.onLine reflects real network-interface connectivity (a real
// browser signal, not a guess) - it can't catch every failure mode (a
// captive portal, or just Supabase being unreachable while local wifi is
// fine), so this is a genuine best-effort EARLY warning, not a
// guarantee. The actual save call's own error handling is still the
// real last line of defense - this only lets a mid-log warning show up
// before the save even fails, for the common case (wifi/cell dropped)
// where the browser already knows.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

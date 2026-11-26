'use client'

import { useEffect } from 'react'

/** Registers the service worker in production builds only, so development reloads are not cached. */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
      console.error('Service worker registration failed:', err)
    })
  }, [])
  return null
}

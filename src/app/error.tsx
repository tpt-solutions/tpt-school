'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Digest is safe to show/log; the raw message may contain server details.
    console.error('Unhandled route error:', error.digest ?? error.message)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        An unexpected error occurred. You can try again, or return to the dashboard if it keeps happening.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => { window.location.href = '/dashboard' }}>
          Dashboard
        </Button>
      </div>
    </main>
  )
}

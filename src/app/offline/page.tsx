import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline · TPT School',
}

// Shown by the service worker when a page is requested with no connection.
// Deliberately static: it shows no school data.
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">You are offline</h1>
        <p className="text-slate-600">
          TPT School needs a connection to load your records. Check your network and try again.
        </p>
        <p className="text-sm text-slate-500">
          Nothing is saved on this device while offline, so anything you were entering needs to be submitted again once you reconnect.
        </p>
        <a
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </a>
      </div>
    </main>
  )
}

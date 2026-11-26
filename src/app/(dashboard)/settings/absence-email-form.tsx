'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateAbsenceEmailSettingAction } from './absence-email-actions'

export default function AbsenceEmailForm({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !enabled
    setError(null)
    startTransition(async () => {
      const res = await updateAbsenceEmailSettingAction(next)
      if (res.success) {
        setEnabled(next)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(res.error ?? 'Failed to update settings.')
      }
    })
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Absence emails</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Email guardians when a child is marked absent</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Sent once per guardian, student and day, when the roll is saved. Uses the email provider in Settings. Off by default.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Email guardians when a child is marked absent"
            onClick={toggle}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              enabled ? 'bg-primary' : 'bg-slate-200'
            } ${isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {saved && <p role="status" className="text-xs text-green-600 mt-2">Saved.</p>}
        {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  )
}

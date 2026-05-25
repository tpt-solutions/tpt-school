'use client'

import { useState } from 'react'
import { updateMessagingSettingsAction } from '@/app/(dashboard)/communication/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function MessagingForm({ parentMessagingDefault }: { parentMessagingDefault: boolean }) {
  const [enabled, setEnabled] = useState(parentMessagingDefault)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function toggle() {
    setSaving(true)
    const next = !enabled
    setEnabled(next)
    await updateMessagingSettingsAction(next)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Parent &amp; Student Replies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Default: allow replies</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Sets the default for new staff members. Individual staff can override this on their own profile.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={toggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                enabled ? 'bg-primary' : 'bg-slate-200'
              } ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {saved && <p className="text-xs text-green-600 mt-2">Saved.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

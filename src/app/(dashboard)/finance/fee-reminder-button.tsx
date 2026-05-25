'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { triggerFeeRemindersAction } from './actions'
import { Bell } from 'lucide-react'

export default function FeeReminderButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setResult(null)
    const res = await triggerFeeRemindersAction()
    if (res.success) {
      setResult(
        res.sent === 0
          ? 'No reminders needed — all recent invoices were already reminded within 7 days.'
          : `Sent ${res.sent} reminder${res.sent !== 1 ? 's' : ''}${res.skipped ? `, skipped ${res.skipped}` : ''}.`,
      )
    } else {
      setResult(res.error ?? 'Failed to send reminders.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleClick} disabled={loading}>
        <Bell className="w-4 h-4 mr-2" />
        {loading ? 'Sending…' : 'Send Overdue Reminders'}
      </Button>
      {result && (
        <p className="text-xs text-slate-500 max-w-xs text-right">{result}</p>
      )}
    </div>
  )
}

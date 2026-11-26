'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { payInvoiceOnlineAction } from './actions'

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await payInvoiceOnlineAction(invoiceId)
      if (!result.success || !result.url) {
        setError(result.error ?? 'Could not start the payment.')
        return
      }
      // Leave the site for Stripe's hosted payment page; the webhook records the payment
      window.location.assign(result.url)
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Opening…' : 'Pay online'}
      </Button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

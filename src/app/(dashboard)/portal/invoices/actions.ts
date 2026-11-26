'use server'

import { requireRole } from '@/lib/auth'
import { createInvoiceCheckout } from '@/lib/payments'

/** Starts a Stripe Checkout for one invoice and returns the hosted payment page address. */
export async function payInvoiceOnlineAction(
  invoiceId: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const user = await requireRole(['parent'])
  if (!invoiceId || invoiceId.length > 64) return { success: false, error: 'Invoice not found.' }

  try {
    const result = await createInvoiceCheckout(user, invoiceId)
    if ('error' in result) return { success: false, error: result.error }
    return { success: true, url: result.url }
  } catch (err) {
    console.error('payInvoiceOnlineAction error:', err)
    return { success: false, error: 'Could not start the payment. Please try again.' }
  }
}

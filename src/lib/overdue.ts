import 'server-only'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/email-queue'
import { formatCents } from '@/lib/money'

/**
 * Overdue escalation for fee invoices.
 *
 * Any unpaid or partly paid invoice past its due date is moved to status "overdue". Each run sends
 * the active administrators one queued digest listing the invoices that became overdue in that run.
 * Invoices already marked overdue are not counted again, so the digest is sent once per invoice.
 */

export type OverdueRunResult = { newlyOverdue: number; digestsQueued: number }

const MAX_LINES_IN_DIGEST = 50

export async function escalateOverdueInvoices(now = new Date()): Promise<OverdueRunResult> {
  const candidates = await db.feeInvoice.findMany({
    where: { status: { in: ['unpaid', 'partial'] }, dueDate: { lt: now } },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { dueDate: 'asc' },
  })
  if (candidates.length === 0) return { newlyOverdue: 0, digestsQueued: 0 }

  // Only update rows still in the same state, so a payment landing mid-run is not overwritten.
  const ids = candidates.map(c => c.id)
  const updated = await db.feeInvoice.updateMany({
    where: { id: { in: ids }, status: { in: ['unpaid', 'partial'] } },
    data: { status: 'overdue' },
  })
  if (updated.count === 0) return { newlyOverdue: 0, digestsQueued: 0 }

  const admins = await db.user.findMany({
    where: { role: 'admin', active: true, email: { not: '' } },
    select: { email: true },
  })
  const settings = await db.schoolSettings.findFirst({ select: { name: true, currencySymbol: true } })
  const symbol = settings?.currencySymbol ?? '$'

  const lines = candidates.slice(0, MAX_LINES_IN_DIGEST).map(inv => {
    const outstanding = inv.totalAmountCents - inv.paidAmountCents
    return `<li>${escape(inv.student.user.name)}: ${escape(symbol + formatCents(outstanding, ''))} due ${inv.dueDate.toLocaleDateString('en-GB')}</li>`
  })
  const more = candidates.length > MAX_LINES_IN_DIGEST ? `<li>…and ${candidates.length - MAX_LINES_IN_DIGEST} more</li>` : ''
  const subject = `${updated.count} fee invoice${updated.count === 1 ? ' is' : 's are'} now overdue`
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${escape(settings?.name ?? 'School')}: overdue fees</h2>
      <p>${updated.count} invoice${updated.count === 1 ? ' has' : 's have'} passed the due date without full payment:</p>
      <ul>${lines.join('')}${more}</ul>
      <p>Reminders are sent to parents automatically. Record payments in Finance.</p>
    </div>`

  let digestsQueued = 0
  for (const admin of admins) {
    if (!admin.email) continue
    await enqueueEmail({ to: admin.email.toLowerCase(), subject, html, logBody: subject })
    digestsQueued++
  }

  return { newlyOverdue: updated.count, digestsQueued }
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

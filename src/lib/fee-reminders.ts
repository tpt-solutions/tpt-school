import 'server-only'
import { db } from '@/lib/db'
import { sendEmail, feeReminderEmailHtml } from '@/lib/email'
import { escalateOverdueInvoices } from '@/lib/overdue'

export type FeeReminderResult = { sent: number; skipped: number; errors: number }

// Sends payment reminders for overdue invoices (at most one every 7 days per invoice).
// Shared by the CRON route, the admin "send reminders" action, and the in-process scheduler.
// It also runs overdue escalation first, so invoices past due are marked "overdue" and admins are told.
export async function sendFeeReminders(): Promise<FeeReminderResult> {
  await escalateOverdueInvoices().catch(err => console.error('Overdue escalation failed:', err))

  const settings = await db.schoolSettings.findFirst()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const overdueInvoices = await db.feeInvoice.findMany({
    where: {
      // Include "overdue": reminders must keep going after escalation.
      status: { in: ['unpaid', 'partial', 'overdue'] },
      dueDate: { lt: now },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lt: sevenDaysAgo } },
      ],
    },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          parents: {
            where: { isPrimary: true },
            include: { parent: { include: { user: { select: { name: true, email: true } } } } },
            take: 1,
          },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const invoice of overdueInvoices) {
    const primaryParent = invoice.student.parents[0]?.parent
    if (!primaryParent?.user.email) { skipped++; continue }

    const outstanding = invoice.totalAmountCents - invoice.paidAmountCents
    if (outstanding <= 0) { skipped++; continue }

    const html = feeReminderEmailHtml(
      primaryParent.user.name,
      invoice.student.user.name,
      invoice.id,
      outstanding,
      invoice.dueDate,
      settings?.currencySymbol ?? '$',
      settings?.name ?? 'School',
    )

    const result = await sendEmail({
      to: primaryParent.user.email,
      subject: `Fee payment reminder — ${invoice.student.user.name}`,
      html,
    })

    if (result.success) {
      await db.feeInvoice.update({
        where: { id: invoice.id },
        data: { lastReminderSentAt: new Date() },
      })
      sent++
    } else {
      errors++
    }
  }

  return { sent, skipped, errors }
}

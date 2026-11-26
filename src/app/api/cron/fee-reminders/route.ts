import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, feeReminderEmailHtml } from '@/lib/email'

// Protected by CRON_SECRET — pass it as "Authorization: Bearer <secret>" from a scheduler.
// Fails closed: if CRON_SECRET is unset, every request is rejected.
// The admin UI does not call this route; it uses runFeeReminders() directly (server action).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 401 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await sendFeeReminders())
}

export async function runFeeReminders() {
  return sendFeeReminders()
}

async function sendFeeReminders(): Promise<{ sent: number; skipped: number; errors: number }> {
  const settings = await db.schoolSettings.findFirst()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const overdueInvoices = await db.feeInvoice.findMany({
    where: {
      status: { in: ['unpaid', 'partial'] },
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

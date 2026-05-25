import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, feeReminderEmailHtml } from '@/lib/email'

// Protected by CRON_SECRET header — set this env var and pass it as
// "Authorization: Bearer <secret>" when calling from a scheduler.
// Admin UI calls this directly without the header check (server action wrapper).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

    const outstanding = invoice.totalAmount - invoice.paidAmount
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

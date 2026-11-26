'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseAmountToCents, formatCents } from '@/lib/money'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendEmail, invoiceEmailHtml } from '@/lib/email'
import { runFeeReminders } from '@/app/api/cron/fee-reminders/route'

// ─── Fee Types ────────────────────────────────────────────────────────────────

export async function createFeeTypeAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const amountRaw = formData.get('amount') as string
    const frequency = (formData.get('frequency') as string) || 'annual'
    const yearLevelRaw = formData.get('yearLevel') as string
    const active = formData.get('active') !== 'false'

    if (!name || !amountRaw) {
      return { success: false, error: 'Name and amount are required.' }
    }

    const amountCents = parseAmountToCents(amountRaw)
    if (amountCents === null) {
      return { success: false, error: 'Amount must be a valid positive number with at most two decimal places.' }
    }

    await db.feeType.create({
      data: {
        name,
        description,
        amountCents,
        frequency,
        yearLevel: yearLevelRaw ? parseInt(yearLevelRaw, 10) : null,
        active,
      },
    })

    revalidatePath('/finance/fee-types')
    return { success: true }
  } catch (err: unknown) {
    console.error('createFeeTypeAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateFeeTypeAction(
  id: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const amountRaw = formData.get('amount') as string
    const frequency = (formData.get('frequency') as string) || 'annual'
    const yearLevelRaw = formData.get('yearLevel') as string
    const active = formData.get('active') === 'true'

    if (!name || !amountRaw) {
      return { success: false, error: 'Name and amount are required.' }
    }

    const amountCents = parseAmountToCents(amountRaw)
    if (amountCents === null) {
      return { success: false, error: 'Amount must be a valid positive number with at most two decimal places.' }
    }

    await db.feeType.update({
      where: { id },
      data: {
        name,
        description,
        amountCents,
        frequency,
        yearLevel: yearLevelRaw ? parseInt(yearLevelRaw, 10) : null,
        active,
      },
    })

    revalidatePath('/finance/fee-types')
    return { success: true }
  } catch (err: unknown) {
    console.error('updateFeeTypeAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function createInvoiceAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    await requireRole(['admin'])

    const studentId = formData.get('studentId') as string
    const dueDateRaw = formData.get('dueDate') as string
    const notes = (formData.get('notes') as string)?.trim() || null
    const itemDescriptions = formData.getAll('itemDescription') as string[]
    const itemAmounts = formData.getAll('itemAmount') as string[]
    const itemFeeTypeIds = formData.getAll('itemFeeTypeId') as string[]

    if (!studentId || !dueDateRaw) {
      return { success: false, error: 'Student and due date are required.' }
    }

    if (itemDescriptions.length === 0) {
      return { success: false, error: 'At least one line item is required.' }
    }

    const items = itemDescriptions.map((desc, i) => ({
      description: desc.trim(),
      amountCents: parseAmountToCents(itemAmounts[i] ?? '') ?? NaN,
      feeTypeId: itemFeeTypeIds[i] || null,
    }))
    if (items.some(item => !Number.isInteger(item.amountCents) || item.amountCents < 0)) {
      return { success: false, error: 'Every line item needs a valid amount (up to two decimal places).' }
    }

    const totalAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)

    const invoice = await db.feeInvoice.create({
      data: {
        studentId,
        dueDate: new Date(dueDateRaw),
        issueDate: new Date(),
        status: 'unpaid',
        notes,
        totalAmountCents,
        paidAmountCents: 0,
        items: {
          create: items.map(item => ({
            description: item.description,
            amountCents: item.amountCents,
            feeTypeId: item.feeTypeId || undefined,
          })),
        },
      },
    })

    // Fire-and-forget invoice email to parents
    db.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true } },
        parents: { include: { parent: { include: { user: { select: { name: true, email: true } } } } } },
      },
    }).then(student => {
      if (!student) return
      const primaryParent = student.parents.find(sp => sp.isPrimary)?.parent ?? student.parents[0]?.parent
      if (!primaryParent?.user?.email) return
      db.schoolSettings.findFirst().then(settings => {
        const schoolName = settings?.name ?? 'School'
        const symbol = settings?.currencySymbol ?? '$'
        sendEmail({
          to: primaryParent.user!.email,
          subject: `Fee invoice — ${student.user.name}`,
          html: invoiceEmailHtml(primaryParent.user!.name, student.user.name, invoice.id, totalAmountCents, new Date(dueDateRaw), symbol, schoolName),
        }).catch(() => {})
      }).catch(() => {})
    }).catch(() => {})

    revalidatePath('/finance')
    redirect(`/finance/invoices/${invoice.id}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('createInvoiceAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function recordPaymentAction(
  invoiceId: string,
  amountInput: string,
  method: string,
  reference: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole(['admin'])

    const amountCents = parseAmountToCents(amountInput)
    if (amountCents === null || amountCents <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero, with at most two decimal places.' }
    }

    // Atomic increment inside a transaction: concurrent payments cannot overwrite each other's totals
    const outcome = await db.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.findUnique({ where: { id: invoiceId } })
      if (!invoice) return { error: 'Invoice not found.' as const }

      const outstandingCents = invoice.totalAmountCents - invoice.paidAmountCents
      if (amountCents > outstandingCents) {
        return { error: 'Payment exceeds the outstanding balance.' as const }
      }

      const updated = await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { paidAmountCents: { increment: amountCents } },
        select: { paidAmountCents: true, totalAmountCents: true, status: true },
      })
      const newStatus =
        updated.paidAmountCents >= updated.totalAmountCents
          ? 'paid'
          : updated.paidAmountCents > 0
          ? 'partial'
          : updated.status
      await tx.feeInvoice.update({ where: { id: invoiceId }, data: { status: newStatus } })

      await tx.feePayment.create({
        data: {
          invoiceId,
          amountCents,
          method,
          reference: reference || null,
          notes: notes || null,
          paidAt: new Date(),
          recordedBy: user.id,
        },
      })
      return { ok: true as const }
    })

    if ('error' in outcome) return { success: false, error: outcome.error }

    await logAudit(user.id, 'CREATE', 'FeePayment', `Recorded ${formatCents(amountCents)} (${method}) against invoice ${invoiceId}`, invoiceId)

    revalidatePath('/finance')
    revalidatePath(`/finance/invoices/${invoiceId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('recordPaymentAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Fee Reminders ────────────────────────────────────────────────────────────

export async function triggerFeeRemindersAction(): Promise<{
  success: boolean
  sent?: number
  skipped?: number
  errors?: number
  error?: string
}> {
  try {
    await requireRole(['admin'])
    const result = await runFeeReminders()
    return { success: true, ...result }
  } catch (err: unknown) {
    console.error('triggerFeeRemindersAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

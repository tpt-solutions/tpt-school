'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendEmail, invoiceEmailHtml } from '@/lib/email'

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

    const amount = parseFloat(amountRaw)
    if (isNaN(amount) || amount < 0) {
      return { success: false, error: 'Amount must be a valid positive number.' }
    }

    await db.feeType.create({
      data: {
        name,
        description,
        amount,
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

    const amount = parseFloat(amountRaw)
    if (isNaN(amount) || amount < 0) {
      return { success: false, error: 'Amount must be a valid positive number.' }
    }

    await db.feeType.update({
      where: { id },
      data: {
        name,
        description,
        amount,
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
      amount: parseFloat(itemAmounts[i] ?? '0') || 0,
      feeTypeId: itemFeeTypeIds[i] || null,
    }))

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)

    const invoice = await db.feeInvoice.create({
      data: {
        studentId,
        dueDate: new Date(dueDateRaw),
        issueDate: new Date(),
        status: 'unpaid',
        notes,
        totalAmount,
        paidAmount: 0,
        items: {
          create: items.map(item => ({
            description: item.description,
            amount: item.amount,
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
          html: invoiceEmailHtml(primaryParent.user!.name, student.user.name, invoice.id, totalAmount, new Date(dueDateRaw), symbol, schoolName),
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
  amount: number,
  method: string,
  reference: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole(['admin'])

    const invoice = await db.feeInvoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return { success: false, error: 'Invoice not found.' }

    if (amount <= 0) return { success: false, error: 'Payment amount must be greater than zero.' }

    const newPaidAmount = (invoice.paidAmount ?? 0) + amount
    const newStatus =
      newPaidAmount >= invoice.totalAmount
        ? 'paid'
        : newPaidAmount > 0
        ? 'partial'
        : invoice.status

    await db.$transaction([
      db.feePayment.create({
        data: {
          invoiceId,
          amount,
          method,
          reference: reference || null,
          notes: notes || null,
          paidAt: new Date(),
          recordedBy: user.id,
        },
      }),
      db.feeInvoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      }),
    ])

    revalidatePath('/finance')
    revalidatePath(`/finance/invoices/${invoiceId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('recordPaymentAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

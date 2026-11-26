'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { enqueueEmail } from '@/lib/email-queue'
import { invoiceEmailHtml } from '@/lib/email'
import { field, parseWith } from '@/lib/form'
import { formatCents } from '@/lib/money'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/**
 * "Generate term fees": bills each active student for the fee types that apply to the chosen term.
 *
 * Rules:
 * - A fee with frequency "term" is billed in every term. A fee with frequency "annual" is billed
 *   once a year, with the first term.
 * - A fee with a year level applies only to students in that year level. A blank year level applies to everyone.
 * - One invoice per student per run, listing every applicable fee.
 * - Each billed item carries a billingKey ("<feeTypeId>:<termId or academicYearId>"). A fee already billed
 *   for that key is skipped, so running the job again is safe.
 *
 * Preview first: nothing is written until the admin confirms.
 */

type Plan = {
  termId: string
  termName: string
  academicYearId: string
  invoices: {
    studentId: string
    studentName: string
    parentEmail: string | null
    parentName: string | null
    items: { feeTypeId: string; description: string; amountCents: number; billingKey: string }[]
    totalCents: number
  }[]
  alreadyBilled: number
  feeTypes: { id: string; name: string; amountCents: number; frequency: string; yearLevel: number | null }[]
}

async function buildPlan(termId: string): Promise<Plan> {
  const term = await db.term.findUnique({
    where: { id: termId },
    include: { academicYear: { select: { id: true } } },
  })
  if (!term) throw new Error('Term not found.')

  const feeTypes = await db.feeType.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  const applicable = feeTypes.filter(ft => {
    if (ft.frequency === 'annual') return term.termNumber === 1
    if (ft.frequency === 'term') return true
    return false
  })

  const students = await db.student.findMany({
    where: { enrollmentStatus: 'active' },
    select: {
      id: true,
      yearLevel: true,
      user: { select: { name: true } },
      parents: {
        where: { isPrimary: true },
        take: 1,
        select: { parent: { select: { user: { select: { name: true, email: true } } } } },
      },
    },
    orderBy: { user: { name: 'asc' } },
  })

  // Billing keys already used, for every applicable fee, in one query.
  const keyFor = (feeTypeId: string, frequency: string) =>
    `${feeTypeId}:${frequency === 'annual' ? term.academicYear.id : term.id}`
  const keys = applicable.map(ft => keyFor(ft.id, ft.frequency))
  const existing = keys.length
    ? await db.feeInvoiceItem.findMany({
        where: { billingKey: { in: keys } },
        select: { billingKey: true, invoice: { select: { studentId: true } } },
      })
    : []
  const billed = new Set(existing.map(e => `${e.invoice.studentId}|${e.billingKey}`))

  let alreadyBilled = 0
  const invoices: Plan['invoices'] = []
  for (const s of students) {
    const items: Plan['invoices'][number]['items'] = []
    for (const ft of applicable) {
      if (ft.yearLevel != null && ft.yearLevel !== s.yearLevel) continue
      const billingKey = keyFor(ft.id, ft.frequency)
      if (billed.has(`${s.id}|${billingKey}`)) {
        alreadyBilled++
        continue
      }
      items.push({ feeTypeId: ft.id, description: ft.name, amountCents: ft.amountCents, billingKey })
    }
    if (items.length === 0) continue
    const primary = s.parents[0]?.parent.user
    invoices.push({
      studentId: s.id,
      studentName: s.user.name,
      parentEmail: primary?.email ?? null,
      parentName: primary?.name ?? null,
      items,
      totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    })
  }

  return {
    termId: term.id,
    termName: term.name,
    academicYearId: term.academicYear.id,
    invoices,
    alreadyBilled,
    feeTypes: applicable.map(ft => ({
      id: ft.id,
      name: ft.name,
      amountCents: ft.amountCents,
      frequency: ft.frequency,
      yearLevel: ft.yearLevel,
    })),
  }
}

export type RecurringPreview = {
  termName: string
  invoiceCount: number
  totalCents: number
  alreadyBilled: number
  feeTypes: { name: string; amountCents: number; frequency: string; yearLevel: number | null }[]
  sample: { studentName: string; totalCents: number }[]
}

export async function previewRecurringFeesAction(termId: string): Promise<{ success: boolean; error?: string; preview?: RecurringPreview }> {
  try {
    await requireRole(['admin'])
    const plan = await buildPlan(termId)
    return {
      success: true,
      preview: {
        termName: plan.termName,
        invoiceCount: plan.invoices.length,
        totalCents: plan.invoices.reduce((sum, i) => sum + i.totalCents, 0),
        alreadyBilled: plan.alreadyBilled,
        feeTypes: plan.feeTypes.map(f => ({ name: f.name, amountCents: f.amountCents, frequency: f.frequency, yearLevel: f.yearLevel })),
        sample: plan.invoices.slice(0, 8).map(i => ({ studentName: i.studentName, totalCents: i.totalCents })),
      },
    }
  } catch (err) {
    console.error('previewRecurringFeesAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Preview failed.' }
  }
}

const generateSchema = z.object({
  termId: field.required('Term', 60),
  dueDate: field.date('Due date'),
})

export async function generateRecurringFeesAction(
  input: { termId: string; dueDate: string; confirmed: boolean },
): Promise<{ success: boolean; error?: string; created?: number; skippedNoEmail?: number }> {
  try {
    const user = await requireRole(['admin'])
    const parsed = parseWith(generateSchema, { termId: input.termId, dueDate: input.dueDate })
    if (!parsed.ok) return { success: false, error: parsed.error }
    if (!input.confirmed) return { success: false, error: 'Confirm the run before generating invoices.' }

    const plan = await buildPlan(parsed.data.termId)
    const settings = await db.schoolSettings.findFirst({ select: { name: true, currencySymbol: true } })
    const symbol = settings?.currencySymbol ?? '$'
    const schoolName = settings?.name ?? 'School'

    let created = 0
    let skippedNoEmail = 0
    for (const inv of plan.invoices) {
      const invoice = await db.feeInvoice.create({
        data: {
          studentId: inv.studentId,
          dueDate: parsed.data.dueDate,
          status: 'unpaid',
          notes: `Generated for ${plan.termName}`,
          totalAmountCents: inv.totalCents,
          items: {
            create: inv.items.map(i => ({
              feeTypeId: i.feeTypeId,
              description: i.description,
              amountCents: i.amountCents,
              billingKey: i.billingKey,
            })),
          },
        },
        select: { id: true },
      })
      created++

      if (inv.parentEmail) {
        await enqueueEmail({
          to: inv.parentEmail,
          subject: `Fee invoice — ${inv.studentName}`,
          html: invoiceEmailHtml(
            inv.parentName ?? 'there',
            inv.studentName,
            invoice.id,
            inv.totalCents,
            parsed.data.dueDate,
            symbol,
            schoolName,
          ),
          logBody: `Fee invoice for ${inv.studentName}, ${formatCents(inv.totalCents, symbol)}`,
        })
      } else {
        skippedNoEmail++
      }
    }

    await logAudit(
      user.id,
      'CREATE',
      'FeeInvoice',
      `Generated ${created} term-fee invoice(s) for ${plan.termName}`,
      plan.termId,
    )
    revalidatePath('/finance')
    return { success: true, created, skippedNoEmail }
  } catch (err) {
    console.error('generateRecurringFeesAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Generation failed.' }
  }
}

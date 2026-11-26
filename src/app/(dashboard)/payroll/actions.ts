'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseAmountToCents, formatCents } from '@/lib/money'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/**
 * Pay records only: the admin enters what was paid for each person. The app does not
 * calculate tax, deductions or entitlements, so the figures must come from the payroll
 * process the school already uses. Everything here is admin only and audited.
 */

const runSchema = z.object({
  label: field.required('Label', 80),
  periodStart: field.date('Period start'),
  periodEnd: field.date('Period end'),
  payDate: field.date('Pay date'),
})

const lineSchema = z.object({
  payRunId: field.required('Pay run', 64),
  staffId: field.required('Staff member', 64),
  notes: field.optional('Notes', 300),
})

const idSchema = z.object({ id: field.required('Record', 64) })

function parseMoney(raw: FormDataEntryValue | null, label: string): { ok: true; cents: number } | { ok: false; error: string } {
  const cents = parseAmountToCents(typeof raw === 'string' ? raw : null)
  if (cents === null) return { ok: false, error: `${label} must be a valid amount with at most two decimal places.` }
  return { ok: true, cents }
}

export async function createPayRunAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(runSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { label, periodStart, periodEnd, payDate } = parsed.data

  if (periodEnd < periodStart) return { success: false, error: 'The period must end on or after it starts.' }

  const run = await db.payRun.create({
    data: { label, periodStart, periodEnd, payDate, createdById: session.id },
  })
  await logAudit(session.id, 'CREATE', 'PayRun', `Created pay run "${label}"`, run.id)

  revalidatePath('/payroll')
  return { success: true }
}

export async function addPayLineAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(lineSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { payRunId, staffId, notes } = parsed.data

  const gross = parseMoney(formData.get('grossAmount'), 'Gross amount')
  if (!gross.ok) return { success: false, error: gross.error }
  const net = parseMoney(formData.get('netAmount'), 'Net amount')
  if (!net.ok) return { success: false, error: net.error }
  if (gross.cents <= 0) return { success: false, error: 'Gross amount must be greater than zero.' }
  if (net.cents > gross.cents) return { success: false, error: 'Net pay cannot be more than gross pay.' }

  const run = await db.payRun.findUnique({ where: { id: payRunId }, select: { id: true, status: true, label: true } })
  if (!run) return { success: false, error: 'Pay run not found.' }
  if (run.status !== 'draft') return { success: false, error: 'This pay run has been marked paid and can no longer change.' }

  const staff = await db.staff.findUnique({
    where: { id: staffId },
    include: { user: { select: { name: true } } },
  })
  if (!staff) return { success: false, error: 'Staff member not found.' }

  const existing = await db.payLine.findUnique({ where: { payRunId_staffId: { payRunId, staffId } }, select: { id: true } })
  if (existing) return { success: false, error: `${staff.user.name} already has a line in this pay run.` }

  const line = await db.payLine.create({
    data: { payRunId, staffId, grossCents: gross.cents, netCents: net.cents, notes },
  })
  await logAudit(
    session.id,
    'CREATE',
    'PayLine',
    `Pay line for ${staff.user.name} in "${run.label}": gross ${formatCents(gross.cents)}, net ${formatCents(net.cents)}`,
    line.id,
  )

  revalidatePath(`/payroll/${payRunId}`)
  revalidatePath('/payroll')
  return { success: true }
}

export async function removePayLineAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  const line = await db.payLine.findUnique({
    where: { id: parsed.data.id },
    include: { payRun: { select: { id: true, status: true } }, staff: { include: { user: { select: { name: true } } } } },
  })
  if (!line) return { success: false, error: 'Line not found.' }
  if (line.payRun.status !== 'draft') return { success: false, error: 'This pay run has been marked paid and can no longer change.' }

  await db.payLine.delete({ where: { id: line.id } })
  await logAudit(session.id, 'DELETE', 'PayLine', `Removed pay line for ${line.staff.user.name}`, line.id)

  revalidatePath(`/payroll/${line.payRun.id}`)
  revalidatePath('/payroll')
  return { success: true }
}

export async function markPayRunPaidAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const id = parsed.data.id

  const run = await db.payRun.findUnique({ where: { id }, include: { _count: { select: { lines: true } } } })
  if (!run) return { success: false, error: 'Pay run not found.' }
  if (run.status !== 'draft') return { success: false, error: 'This pay run is already marked paid.' }
  if (run._count.lines === 0) return { success: false, error: 'Add at least one line before marking the run paid.' }

  // Conditional update so two admins cannot both mark the run paid
  const result = await db.payRun.updateMany({
    where: { id, status: 'draft' },
    data: { status: 'paid', paidAt: new Date() },
  })
  if (result.count === 0) return { success: false, error: 'This pay run is already marked paid.' }
  await logAudit(session.id, 'UPDATE', 'PayRun', `Marked pay run "${run.label}" as paid (${run._count.lines} lines)`, id)

  revalidatePath(`/payroll/${id}`)
  revalidatePath('/payroll')
  return { success: true }
}

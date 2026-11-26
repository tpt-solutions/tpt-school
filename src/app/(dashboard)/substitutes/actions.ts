'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const coverSchema = z.object({
  absentStaffId: field.required('Absent staff member', 64),
  date: field.date('Date'),
  periodLabel: field.optional('Period', 50),
  classId: field.optional('Class', 64),
  notes: field.optional('Notes', 500),
})

const idSchema = z.object({ id: field.required('Cover request', 64) })
const assignSchema = z.object({
  id: field.required('Cover request', 64),
  coverStaffId: field.required('Covering teacher', 64),
})

export async function createCoverAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(coverSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { absentStaffId, date, periodLabel, classId, notes } = parsed.data

  const absent = await db.staff.findUnique({ where: { id: absentStaffId }, select: { id: true } })
  if (!absent) return { success: false, error: 'Absent staff member not found.' }
  if (classId) {
    const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } })
    if (!cls) return { success: false, error: 'Class not found.' }
  }

  const cover = await db.substituteCover.create({
    data: { absentStaffId, date, periodLabel, classId, notes, createdById: session.id },
  })
  await logAudit(session.id, 'CREATE', 'SubstituteCover', `Cover needed on ${date.toISOString().slice(0, 10)}`, cover.id)

  revalidatePath('/substitutes')
  return { success: true }
}

export async function assignCoverAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(assignSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { id, coverStaffId } = parsed.data

  const outcome = await db.$transaction(async (tx) => {
    const cover = await tx.substituteCover.findUnique({ where: { id } })
    if (!cover) return { error: 'Cover request not found.' as const }
    if (cover.status === 'cancelled') return { error: 'This cover request has been cancelled.' as const }
    if (cover.absentStaffId === coverStaffId) return { error: 'The absent teacher cannot cover their own class.' as const }

    // A teacher can only cover one request per date and period
    const clash = await tx.substituteCover.findFirst({
      where: {
        id: { not: id },
        coverStaffId,
        status: 'covered',
        date: cover.date,
        periodLabel: cover.periodLabel,
      },
      select: { id: true },
    })
    if (clash) return { error: 'That teacher is already covering another class at this time.' as const }

    await tx.substituteCover.update({ where: { id }, data: { coverStaffId, status: 'covered' } })
    return { ok: true as const }
  })

  if ('error' in outcome) return { success: false, error: outcome.error }
  await logAudit(session.id, 'UPDATE', 'SubstituteCover', 'Assigned covering teacher', id)

  revalidatePath('/substitutes')
  return { success: true }
}

export async function cancelCoverAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  await db.substituteCover.update({
    where: { id: parsed.data.id },
    data: { status: 'cancelled', coverStaffId: null },
  })
  await logAudit(session.id, 'UPDATE', 'SubstituteCover', 'Cancelled cover request', parsed.data.id)

  revalidatePath('/substitutes')
  return { success: true }
}

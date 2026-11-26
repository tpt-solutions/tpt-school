'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { checkbox, field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const visitSchema = z.object({
  studentId: field.required('Student', 64),
  reason: field.required('Reason for visit', 500),
  treatment: field.optional('Treatment', 1000),
})

/**
 * Health visits are sensitive. Admin only, and every entry is written to the audit log.
 * The record is append-only here: there is no edit or delete action.
 */
export async function logHealthVisitAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(visitSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { studentId, reason, treatment } = parsed.data

  const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true } })
  if (!student) return { success: false, error: 'Student not found.' }

  const visit = await db.healthVisit.create({
    data: {
      studentId,
      reason,
      treatment,
      sentHome: checkbox(formData.get('sentHome') as string | null),
      parentNotified: checkbox(formData.get('parentNotified') as string | null),
      recordedById: session.id,
    },
  })
  await logAudit(session.id, 'CREATE', 'HealthVisit', 'Logged health visit', visit.id)

  revalidatePath('/health')
  return { success: true }
}

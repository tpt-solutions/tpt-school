'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { canAccessStudent } from '@/lib/access'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const awardSchema = z.object({
  studentId: field.required('Student', 64),
  points: field.int('Points', 1, 10),
  reason: field.required('Reason', 300),
})

const idSchema = z.object({ id: field.required('Award', 64) })

export async function awardMeritAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])

  const parsed = parseWith(awardSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { studentId, points, reason } = parsed.data

  if (!(await canAccessStudent(session, studentId))) {
    return { success: false, error: 'You can only award points to students you teach.' }
  }

  const award = await db.meritAward.create({
    data: { studentId, points, reason, awardedById: session.id },
  })
  await logAudit(session.id, 'CREATE', 'MeritAward', `Awarded ${points} merit point(s)`, award.id)

  revalidatePath('/merit')
  return { success: true }
}

/** Admins can remove an award that was given in error. */
export async function deleteMeritAwardAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  await db.meritAward.delete({ where: { id: parsed.data.id } })
  await logAudit(session.id, 'DELETE', 'MeritAward', 'Removed merit award', parsed.data.id)

  revalidatePath('/merit')
  return { success: true }
}

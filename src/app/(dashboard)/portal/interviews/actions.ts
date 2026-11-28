'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { linkedStudentsFor } from '@/lib/portal'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const bookSchema = z.object({
  slotId: field.required('Slot', 64),
  studentId: field.required('Student', 64),
})

/**
 * A parent books an open interview slot for one of their own children. The child must be
 * linked to the parent's account, and the slot must still be free and in the future.
 */
export async function bookOwnInterviewAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole(['parent'])

  const parsed = parseWith(bookSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { slotId, studentId } = parsed.data

  const children = await linkedStudentsFor(user)
  if (!children.some((c) => c.id === studentId)) {
    return { success: false, error: 'You can only book interviews for your own children.' }
  }

  // Conditional update: a slot that was just taken, or has started, cannot be booked
  const result = await db.interviewSlot.updateMany({
    where: { id: slotId, studentId: null, startsAt: { gt: new Date() } },
    data: { studentId },
  })
  if (result.count === 0) {
    return { success: false, error: 'That time is no longer available. Please choose another.' }
  }
  await logAudit(user.id, 'UPDATE', 'InterviewSlot', 'Parent booked an interview slot', slotId)

  revalidatePath('/portal/interviews')
  revalidatePath('/interviews')
  return { success: true }
}

/** A parent cancels their own child's booking, so the slot returns to the open list. */
export async function cancelOwnInterviewAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole(['parent'])

  const slotId = formData.get('slotId')
  if (typeof slotId !== 'string' || !slotId || slotId.length > 64) return { success: false, error: 'Booking not found.' }

  const children = await linkedStudentsFor(user)
  const childIds = children.map((c) => c.id)
  // Only the child's own future booking can be cancelled from here
  const result = await db.interviewSlot.updateMany({
    where: { id: slotId, studentId: { in: childIds }, startsAt: { gt: new Date() } },
    data: { studentId: null, notes: null },
  })
  if (result.count === 0) return { success: false, error: 'This booking cannot be cancelled online. Please contact the school office.' }
  await logAudit(user.id, 'UPDATE', 'InterviewSlot', 'Parent cancelled an interview booking', slotId)

  revalidatePath('/portal/interviews')
  revalidatePath('/interviews')
  return { success: true }
}

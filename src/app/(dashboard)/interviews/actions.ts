'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const generateSchema = z.object({
  staffId: field.required('Teacher', 64),
  date: field.required('Date', 10).refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), { message: 'Date must be YYYY-MM-DD.' }),
  startTime: field.required('Start time', 5).refine(v => TIME_PATTERN.test(v), { message: 'Start time must be HH:MM.' }),
  slotMinutes: field.int('Slot length', 5, 60),
  count: field.int('Number of slots', 1, 60),
})

const bookSchema = z.object({
  slotId: field.required('Slot', 64),
  studentId: field.required('Student', 64),
  notes: field.optional('Notes', 500),
})

const idSchema = z.object({ id: field.required('Slot', 64) })

/** Builds a local Date from a YYYY-MM-DD date and an HH:MM time, plus minutes. Avoids UTC midnight shifts. */
function atLocal(dateStr: string, hhmm: string, addMinutes = 0): Date {
  const [y, mo, day] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(y, mo - 1, day, h, m, 0, 0)
  return new Date(d.getTime() + addMinutes * 60_000)
}

export async function generateInterviewSlotsAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(generateSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { staffId, date, startTime, slotMinutes, count } = parsed.data

  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { id: true } })
  if (!staff) return { success: false, error: 'Teacher not found.' }

  const slots = Array.from({ length: count }, (_, i) => ({
    startsAt: atLocal(date, startTime, i * slotMinutes),
    endsAt: atLocal(date, startTime, (i + 1) * slotMinutes),
  }))
  const windowStart = slots[0].startsAt
  const windowEnd = slots[slots.length - 1].endsAt

  const outcome = await db.$transaction(async (tx) => {
    const overlap = await tx.interviewSlot.findFirst({
      where: { staffId, startsAt: { lt: windowEnd }, endsAt: { gt: windowStart } },
      select: { id: true },
    })
    if (overlap) return { error: 'These times overlap existing interview slots for this teacher.' as const }

    await tx.interviewSlot.createMany({
      data: slots.map((s) => ({ ...s, staffId, createdById: session.id })),
    })
    return { ok: true as const }
  })

  if ('error' in outcome) return { success: false, error: outcome.error }
  await logAudit(session.id, 'CREATE', 'InterviewSlot', `Generated ${count} interview slots`, staffId)

  revalidatePath('/interviews')
  return { success: true }
}

export async function bookInterviewSlotAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(bookSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { slotId, studentId, notes } = parsed.data

  // Conditional update: only a free slot can be booked, so two bookings cannot both win
  const result = await db.interviewSlot.updateMany({
    where: { id: slotId, studentId: null },
    data: { studentId, notes },
  })
  if (result.count === 0) return { success: false, error: 'That slot is already booked or no longer exists.' }
  await logAudit(session.id, 'UPDATE', 'InterviewSlot', 'Booked interview slot', slotId)

  revalidatePath('/interviews')
  return { success: true }
}

export async function releaseInterviewSlotAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  await db.interviewSlot.update({
    where: { id: parsed.data.id },
    data: { studentId: null, notes: null },
  })
  await logAudit(session.id, 'UPDATE', 'InterviewSlot', 'Released interview slot', parsed.data.id)

  revalidatePath('/interviews')
  return { success: true }
}

export async function deleteInterviewSlotAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  const result = await db.interviewSlot.deleteMany({ where: { id: parsed.data.id, studentId: null } })
  if (result.count === 0) return { success: false, error: 'Release the booking before deleting this slot.' }
  await logAudit(session.id, 'DELETE', 'InterviewSlot', 'Deleted interview slot', parsed.data.id)

  revalidatePath('/interviews')
  return { success: true }
}

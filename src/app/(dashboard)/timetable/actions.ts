'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { generateSlots, type ProposedSlot } from './generator-algorithm'
import { z } from 'zod'
import { field } from '@/lib/form'

export type { ProposedSlot }

export interface SlotData {
  classId: string
  staffId?: string | null
  roomId?: string | null
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  notes?: string | null
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// Days are 1 (Mon) to 5 (Fri); periods are 1 to 20. Times are zero-padded 24h HH:MM.
const slotSchema = z
  .object({
    classId: field.required('Class', 64),
    staffId: field.optional('Teacher', 64),
    roomId: field.optional('Room', 64),
    dayOfWeek: z.number().int({ message: 'Day must be a whole number.' }).min(1, { message: 'Day must be Monday to Friday.' }).max(5, { message: 'Day must be Monday to Friday.' }),
    period: z.number().int({ message: 'Period must be a whole number.' }).min(1, { message: 'Period must be between 1 and 20.' }).max(20, { message: 'Period must be between 1 and 20.' }),
    startTime: z.string().regex(TIME_PATTERN, { message: 'Start time must be HH:MM.' }),
    endTime: z.string().regex(TIME_PATTERN, { message: 'End time must be HH:MM.' }),
    notes: z.string().max(500, { message: 'Notes must be 500 characters or fewer.' }).nullish(),
  })
  .refine(d => d.endTime > d.startTime, { message: 'End time must be after start time.', path: ['endTime'] })

function slotError(data: SlotData): string | null {
  const result = slotSchema.safeParse(data)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid slot.')
}

export async function createSlotAction(data: SlotData) {
  await requireRole(['admin'])
  const err = slotError(data)
  if (err) return { error: err }

  try {
    await db.timetableSlot.create({
      data: {
        classId: data.classId,
        staffId: data.staffId || null,
        roomId: data.roomId || null,
        dayOfWeek: data.dayOfWeek,
        period: data.period,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes || null,
      },
    })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create slot'
    return { error: msg }
  }
}

export async function updateSlotAction(id: string, data: SlotData) {
  await requireRole(['admin'])
  const err = slotError(data)
  if (err) return { error: err }

  try {
    await db.timetableSlot.update({
      where: { id },
      data: {
        classId: data.classId,
        staffId: data.staffId || null,
        roomId: data.roomId || null,
        dayOfWeek: data.dayOfWeek,
        period: data.period,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes || null,
      },
    })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update slot'
    return { error: msg }
  }
}

export async function deleteSlotAction(id: string) {
  await requireRole(['admin'])

  try {
    await db.timetableSlot.delete({ where: { id } })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete slot'
    return { error: msg }
  }
}

export async function bulkCreateSlotsAction(
  slots: SlotData[],
): Promise<{ created: number; skipped: number; errors: string[] }> {
  await requireRole(['admin'])

  const DAY_LABEL = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const slot of slots) {
    const slotProblem = slotError(slot)
    if (slotProblem) {
      errors.push(slotProblem)
      skipped++
      continue
    }

    const existing = await db.timetableSlot.findFirst({
      where: { classId: slot.classId, dayOfWeek: slot.dayOfWeek, period: slot.period },
    })
    if (existing) { skipped++; continue }

    if (slot.roomId) {
      const roomConflict = await db.timetableSlot.findFirst({
        where: { roomId: slot.roomId, dayOfWeek: slot.dayOfWeek, period: slot.period },
      })
      if (roomConflict) {
        const room = await db.room.findUnique({ where: { id: slot.roomId } })
        errors.push(`Room ${room?.code ?? '?'} already booked on ${DAY_LABEL[slot.dayOfWeek]} P${slot.period}`)
        skipped++
        continue
      }
    }

    if (slot.staffId) {
      const teacherConflict = await db.timetableSlot.findFirst({
        where: { staffId: slot.staffId, dayOfWeek: slot.dayOfWeek, period: slot.period },
      })
      if (teacherConflict) {
        const s = await db.staff.findUnique({ where: { id: slot.staffId }, include: { user: true } })
        errors.push(`${s?.user.name ?? 'Teacher'} already scheduled on ${DAY_LABEL[slot.dayOfWeek]} P${slot.period}`)
        skipped++
        continue
      }
    }

    try {
      await db.timetableSlot.create({
        data: {
          classId: slot.classId,
          staffId: slot.staffId ?? null,
          roomId: slot.roomId ?? null,
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
          startTime: slot.startTime,
          endTime: slot.endTime,
          notes: slot.notes ?? null,
        },
      })
      created++
    } catch {
      errors.push(`Failed to create slot for ${DAY_LABEL[slot.dayOfWeek]} P${slot.period}`)
      skipped++
    }
  }

  revalidatePath('/timetable')
  return { created, skipped, errors }
}

// ─── Schedule Generator Actions ───────────────────────────────────────────────

export interface RequirementData {
  classId: string
  staffId?: string | null
  preferredRoomId?: string | null
  periodsPerWeek: number
  label?: string | null
}

export async function createRequirementAction(data: RequirementData) {
  await requireRole(['admin'])
  if (!Number.isInteger(data.periodsPerWeek) || data.periodsPerWeek < 1 || data.periodsPerWeek > 20) {
    return { error: 'Periods per week must be a whole number between 1 and 20' }
  }
  if (data.label && data.label.length > 100) {
    return { error: 'Label must be 100 characters or fewer' }
  }

  try {
    await db.timetableRequirement.create({
      data: {
        classId: data.classId,
        staffId: data.staffId ?? null,
        preferredRoomId: data.preferredRoomId ?? null,
        periodsPerWeek: data.periodsPerWeek,
        label: data.label ?? null,
      },
    })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create requirement'
    if (msg.includes('Unique constraint')) return { error: 'A requirement already exists for this class/staff combination' }
    return { error: msg }
  }
}

export async function deleteRequirementAction(id: string) {
  await requireRole(['admin'])

  try {
    await db.timetableRequirement.delete({ where: { id } })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete requirement'
    return { error: msg }
  }
}

export async function generateScheduleAction(): Promise<{ slots: ProposedSlot[]; warnings: string[] }> {
  await requireRole(['admin'])

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })

  const [requirements, existingSlots] = await Promise.all([
    db.timetableRequirement.findMany(),
    db.timetableSlot.findMany({
      where: activeYear ? { class: { academicYearId: activeYear.id } } : undefined,
      select: { classId: true, staffId: true, roomId: true, dayOfWeek: true, period: true },
    }),
  ])

  const slots = generateSlots(requirements, existingSlots)
  const warnings = slots.filter((s) => s.warning).map((s) => s.warning!)

  return { slots, warnings }
}

export async function applyGeneratedScheduleAction(
  slots: ProposedSlot[],
  clearExisting: boolean,
): Promise<{ created: number; errors: string[] }> {
  await requireRole(['admin'])

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })
  let created = 0
  const errors: string[] = []

  try {
    if (clearExisting && activeYear) {
      await db.timetableSlot.deleteMany({
        where: { class: { academicYearId: activeYear.id } },
      })
    }

    for (const slot of slots) {
      try {
        await db.timetableSlot.create({
          data: {
            classId: slot.classId,
            staffId: slot.staffId ?? null,
            roomId: slot.roomId ?? null,
            dayOfWeek: slot.dayOfWeek,
            period: slot.period,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
        created++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        errors.push(`Day ${slot.dayOfWeek} P${slot.period}: ${msg}`)
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to apply schedule'
    return { created: 0, errors: [msg] }
  }

  revalidatePath('/timetable')
  return { created, errors }
}

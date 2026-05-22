'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

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

export async function createSlotAction(data: SlotData) {
  await requireRole(['admin'])

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

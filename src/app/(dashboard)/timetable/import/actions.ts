'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { bulkCreateSlotsAction, type SlotData } from '../actions'

// One row per period. Conflict checks (room, teacher, duplicate class slot) run in bulkCreateSlotsAction.
const MAX_IMPORT_ROWS = 1000

const DAY_NUMBERS: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5,
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export type TimetableImportOutcome = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

export async function importTimetableAction(rows: Record<string, string>[]): Promise<TimetableImportOutcome> {
  const actor = await requireRole(['admin'])

  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, imported: 0, skipped: 0, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`] }
  }

  const activeYear = await db.academicYear.findFirst({ where: { active: true }, select: { id: true } })
  if (!activeYear) {
    return { success: false, imported: 0, skipped: 0, errors: ['No active academic year. Set one before importing.'] }
  }

  // Look up every reference once, then resolve each row from these maps
  const [classes, rooms, staff] = await Promise.all([
    db.class.findMany({ where: { academicYearId: activeYear.id }, select: { id: true, code: true } }),
    db.room.findMany({ select: { id: true, code: true } }),
    db.staff.findMany({ select: { id: true, employeeId: true } }),
  ])
  const classByCode = new Map(classes.map((c) => [c.code.toLowerCase(), c.id] as const))
  const roomByCode = new Map(rooms.map((r) => [r.code.toLowerCase(), r.id] as const))
  const staffByEmployeeId = new Map(staff.map((s) => [s.employeeId.toLowerCase(), s.id] as const))

  const errors: string[] = []
  const slots: SlotData[] = []
  let skipped = 0

  rows.forEach((row, index) => {
    const label = `Row ${index + 1}`
    const classId = classByCode.get((row.classCode ?? '').trim().toLowerCase())
    if (!classId) { errors.push(`${label}: no class with code "${row.classCode ?? ''}" in the active year.`); skipped++; return }

    const dayKey = (row.day ?? '').trim().toLowerCase()
    const dayOfWeek = DAY_NUMBERS[dayKey] ?? (/^[1-5]$/.test(dayKey) ? Number(dayKey) : undefined)
    if (!dayOfWeek) { errors.push(`${label}: day must be Mon to Fri.`); skipped++; return }

    const period = Number((row.period ?? '').trim())
    if (!Number.isInteger(period) || period < 1 || period > 20) { errors.push(`${label}: period must be 1 to 20.`); skipped++; return }

    const startTime = (row.startTime ?? '').trim()
    const endTime = (row.endTime ?? '').trim()
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime) || endTime <= startTime) {
      errors.push(`${label}: start and end times must be HH:MM with the end after the start.`)
      skipped++
      return
    }

    let roomId: string | null = null
    const roomCode = (row.roomCode ?? '').trim().toLowerCase()
    if (roomCode) {
      roomId = roomByCode.get(roomCode) ?? null
      if (!roomId) { errors.push(`${label}: no room with code "${row.roomCode}".`); skipped++; return }
    }

    let staffId: string | null = null
    const teacherId = (row.teacherId ?? '').trim().toLowerCase()
    if (teacherId) {
      staffId = staffByEmployeeId.get(teacherId) ?? null
      if (!staffId) { errors.push(`${label}: no teacher with employee ID "${row.teacherId}".`); skipped++; return }
    }

    slots.push({
      classId,
      roomId,
      staffId,
      dayOfWeek,
      period,
      startTime,
      endTime,
      notes: (row.notes ?? '').trim().slice(0, 500) || null,
    })
  })

  const result = await bulkCreateSlotsAction(slots)
  await logAudit(actor.id, 'CREATE', 'TimetableSlot', `Timetable import: ${result.created} created, ${result.skipped + skipped} skipped`)

  return {
    success: true,
    imported: result.created,
    skipped: result.skipped + skipped,
    errors: [...errors, ...result.errors],
  }
}

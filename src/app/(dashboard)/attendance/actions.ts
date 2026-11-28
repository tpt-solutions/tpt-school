'use server'

import { randomInt } from 'node:crypto'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { teachesClass } from '@/lib/access'
import { field, parseWith, queryDate } from '@/lib/form'
import { checkTruancy } from '@/lib/truancy'
import { notifyGuardiansOfAbsences } from '@/lib/absence-notify'
import { z } from 'zod'

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const

export interface AttendanceRecord {
  studentId: string
  status: string
  notes?: string
}

const rollSchema = z.object({
  classId: field.required('Class', 64),
  records: z
    .array(
      z.object({
        studentId: field.required('Student', 64),
        status: field.oneOf('Attendance status', ATTENDANCE_STATUSES),
        notes: field.optional('Notes', 500),
      }),
    )
    .max(500, { message: 'Too many records in one roll.' }),
})

export async function saveAttendanceAction(
  classId: string,
  records: AttendanceRecord[]
) {
  const session = await requireRole(['admin', 'teacher'])

  const parsed = parseWith(rollSchema, { classId, records })
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data
  const roll = input.records

  if (!(await teachesClass(session, input.classId))) {
    return { error: 'You are not a teacher of this class' }
  }

  // Every student in the roll must be actively enrolled in this class
  const enrolled = new Set(
    (await db.classEnrolment.findMany({
      where: { classId: input.classId, status: 'active' },
      select: { studentId: true },
    })).map(e => e.studentId)
  )
  if (roll.some(r => !enrolled.has(r.studentId))) {
    return { error: 'One or more students are not enrolled in this class' }
  }

  // Find the current term
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const term = await db.term.findFirst({
    where: {
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { startDate: 'desc' },
  })

  if (!term) {
    return { error: 'No active term found for today' }
  }

  try {
    // Upsert each attendance record
    await Promise.all(
      roll.map((record) =>
        db.attendance.upsert({
          where: { studentId_date: { studentId: record.studentId, date: today } },
          create: {
            studentId: record.studentId,
            termId: term.id,
            date: today,
            status: record.status,
            notes: record.notes || null,
            markedById: session.id,
            markedAt: new Date(),
          },
          update: {
            status: record.status,
            notes: record.notes || null,
            markedById: session.id,
            markedAt: new Date(),
          },
        })
      )
    )

    // Run truancy checks for all students in the roll (fire-and-forget, don't block save)
    const absentStudents = roll.filter(r => r.status === 'absent').map(r => r.studentId)
    if (absentStudents.length > 0) {
      await Promise.all(absentStudents.map(sid => checkTruancy(sid, term.id)))
      // Never throws, so a mail problem cannot make the roll save look like it failed.
      await notifyGuardiansOfAbsences(absentStudents, today).catch(err =>
        console.error('Absence notifications failed:', err),
      )
    }

    revalidatePath(`/attendance/roll/${input.classId}`)
    revalidatePath('/attendance')
    revalidatePath('/behaviour')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save attendance'
    return { error: msg }
  }
}

export async function generateAttendanceCodeAction(
  classId: string,
  termId: string,
  windowMins = 5,
) {
  const session = await requireRole(['admin', 'teacher'])

  const parsed = parseWith(
    z.object({
      classId: field.required('Class', 64),
      termId: field.required('Term', 64),
      windowMins: z
        .number({ message: 'Window must be a whole number of minutes.' })
        .int({ message: 'Window must be a whole number of minutes.' })
        .min(1, { message: 'Window must be between 1 and 60 minutes' })
        .max(60, { message: 'Window must be between 1 and 60 minutes' }),
    }),
    { classId, termId, windowMins },
  )
  if (!parsed.ok) return { error: parsed.error }

  if (!(await teachesClass(session, parsed.data.classId))) {
    return { error: 'You are not a teacher of this class' }
  }

  // crypto-grade randomness: this code gates attendance self-check-in
  const code = randomInt(0, 1000000).toString().padStart(6, '0')
  const now = new Date()
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  const expiresAt = new Date(now.getTime() + windowMins * 60 * 1000)

  const record = await db.attendanceCode.create({
    data: { code, classId, date, termId, createdById: session.id, windowMins, expiresAt },
  })

  return { code: record.code, expiresAt: record.expiresAt.toISOString() }
}

export interface AttendanceFilters {
  studentId?: string
  classId?: string
  startDate?: string
  endDate?: string
}

export async function getAttendanceReport(filters: AttendanceFilters) {
  await requireRole(['admin'])

  // Invalid dates are ignored (as on the report page) rather than crashing the request
  const startDate = queryDate(filters.startDate)
  const endDate = queryDate(filters.endDate)
  if (endDate) endDate.setHours(23, 59, 59, 999)
  // IDs come from the UI, but cap their length before they reach a query
  if ((filters.studentId ?? '').length > 64 || (filters.classId ?? '').length > 64) {
    throw new Error('Invalid filter')
  }

  // If filtering by classId, get enrolled student IDs
  let studentIds: string[] | undefined
  if (filters.classId) {
    const enrolments = await db.classEnrolment.findMany({
      where: { classId: filters.classId, status: 'active' },
      select: { studentId: true },
    })
    studentIds = enrolments.map((e: { studentId: string }) => e.studentId)
  }

  const records = await db.attendance.findMany({
    where: {
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      student: { include: { user: true } },
      term: true,
    },
    orderBy: [{ date: 'desc' }, { student: { user: { name: 'asc' } } }],
  })

  return records
}

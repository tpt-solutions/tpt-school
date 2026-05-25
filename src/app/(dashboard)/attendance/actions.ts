'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { checkTruancyAction } from '@/app/(dashboard)/behaviour/actions'

export interface AttendanceRecord {
  studentId: string
  status: string
  notes?: string
}

export async function saveAttendanceAction(
  classId: string,
  records: AttendanceRecord[]
) {
  const session = await requireRole(['admin', 'teacher'])

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
      records.map((record) =>
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
    const absentStudents = records.filter(r => r.status === 'absent').map(r => r.studentId)
    if (absentStudents.length > 0) {
      await Promise.all(absentStudents.map(sid => checkTruancyAction(sid, term.id)))
    }

    revalidatePath(`/attendance/roll/${classId}`)
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

  const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
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

  const startDate = filters.startDate ? new Date(filters.startDate) : undefined
  const endDate = filters.endDate ? new Date(filters.endDate) : undefined
  if (endDate) endDate.setHours(23, 59, 59, 999)

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

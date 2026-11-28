'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { isCodeEntryAllowed, recordCodeFailure } from '@/lib/rate-limit'

export async function submitAttendanceCodeAction(code: string): Promise<{ success?: true; error?: string }> {
  const session = await requireRole(['student'])

  // Codes are always six digits; reject anything else before it reaches the database
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { error: 'Invalid code' }

  const student = await db.student.findFirst({
    where: { userId: session.id },
  })
  if (!student) return { error: 'Student record not found' }

  const limiterKey = `student:${student.id}`
  if (!isCodeEntryAllowed(limiterKey)) {
    return { error: 'Too many incorrect codes. Please wait a few minutes and try again.' }
  }

  const now = new Date()

  try {
    return await db.$transaction(async (tx) => {
      const attendanceCode = await tx.attendanceCode.findUnique({
        where: { code },
      })

      if (!attendanceCode) {
        recordCodeFailure(limiterKey)
        return { error: 'Invalid code' }
      }
      if (attendanceCode.expiresAt < now) return { error: 'This code has expired' }

      const existing = await tx.attendanceCodeUsage.findUnique({
        where: { codeId_studentId: { codeId: attendanceCode.id, studentId: student.id } },
      })
      if (existing) return { error: 'You have already used this code' }

      await tx.attendanceCodeUsage.create({
        data: { codeId: attendanceCode.id, studentId: student.id },
      })

      const date = new Date(attendanceCode.date)
      date.setHours(0, 0, 0, 0)

      await tx.attendance.upsert({
        where: { studentId_date: { studentId: student.id, date } },
        create: {
          studentId: student.id,
          termId: attendanceCode.termId,
          date,
          status: 'present',
          markedById: session.id,
          markedAt: now,
        },
        update: {
          status: 'present',
          markedById: session.id,
          markedAt: now,
        },
      })

      return { success: true as const }
    })
  } catch {
    return { error: 'Failed to record attendance. Please try again.' }
  }
}

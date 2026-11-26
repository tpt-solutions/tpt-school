'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, parseWith } from '@/lib/form'
import { appendToWaitlistTx, ClassFullError, enrolInTx } from '@/lib/enrolment'

const MAX_IMPORT_ROWS = 1000

const enrolmentRowSchema = z.object({
  studentCode: field.required('Student ID', 60),
  classCode: field.required('Class code', 30),
})

export type ImportEnrolmentsResult = {
  success: boolean
  imported: number
  enrolled: number
  waitlisted: number
  skipped: number
  errors: string[]
}

/**
 * Enrols students in classes of the active academic year, matched by student ID and class code.
 * A full class puts the student on the waitlist instead. A student already enrolled or waitlisted
 * is skipped, so re-running the file is safe. Each row is its own transaction.
 */
export async function importEnrolmentsAction(rows: Record<string, string>[]): Promise<ImportEnrolmentsResult> {
  const user = await requireRole(['admin'])

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      imported: 0,
      enrolled: 0,
      waitlisted: 0,
      skipped: 0,
      errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`],
    }
  }

  const activeYear = await db.academicYear.findFirst({ where: { active: true }, select: { id: true, year: true } })
  if (!activeYear) {
    return {
      success: false,
      imported: 0,
      enrolled: 0,
      waitlisted: 0,
      skipped: 0,
      errors: ['No active academic year. Set one in Settings before importing enrolments.'],
    }
  }

  let enrolled = 0
  let waitlisted = 0
  let skipped = 0
  const errors: string[] = []

  for (const raw of rows) {
    const parsed = parseWith(enrolmentRowSchema, raw)
    if (!parsed.ok) {
      errors.push(`Row ${raw?.studentCode || '?'} / ${raw?.classCode || '?'}: ${parsed.error}`)
      continue
    }
    const { studentCode, classCode } = parsed.data

    const [student, cls] = await Promise.all([
      db.student.findUnique({ where: { studentId: studentCode }, select: { id: true, enrollmentStatus: true } }),
      db.class.findFirst({ where: { academicYearId: activeYear.id, code: classCode }, select: { id: true } }),
    ])
    if (!student) {
      errors.push(`Unknown student ID ${studentCode}.`)
      continue
    }
    if (!cls) {
      errors.push(`No class with code ${classCode} in ${activeYear.year}.`)
      continue
    }
    if (student.enrollmentStatus !== 'active') {
      errors.push(`${studentCode} is not an active student.`)
      continue
    }

    try {
      const outcome = await db.$transaction(async tx => {
        const already = await tx.classEnrolment.findFirst({
          where: { classId: cls.id, studentId: student.id, status: 'active' },
          select: { id: true },
        })
        if (already) return 'skipped' as const

        const waiting = await tx.waitlistEntry.findFirst({
          where: { classId: cls.id, studentId: student.id },
          select: { id: true },
        })
        if (waiting) return 'skipped' as const

        try {
          await enrolInTx(tx, cls.id, student.id)
          return 'enrolled' as const
        } catch (err) {
          if (err instanceof ClassFullError) {
            await appendToWaitlistTx(tx, cls.id, student.id)
            return 'waitlisted' as const
          }
          throw err
        }
      })
      if (outcome === 'enrolled') enrolled++
      else if (outcome === 'waitlisted') waitlisted++
      else skipped++
    } catch (err) {
      console.error('Enrolment import row failed:', err)
      errors.push(`${studentCode} into ${classCode}: could not be saved.`)
    }
  }

  if (enrolled + waitlisted > 0) {
    await logAudit(
      user.id,
      'CREATE',
      'ClassEnrolment',
      `Imported enrolments: ${enrolled} enrolled, ${waitlisted} waitlisted, ${skipped} skipped`,
    )
    revalidatePath('/classes')
  }

  return {
    success: errors.length === 0 || enrolled + waitlisted > 0,
    imported: enrolled + waitlisted,
    enrolled,
    waitlisted,
    skipped,
    errors,
  }
}

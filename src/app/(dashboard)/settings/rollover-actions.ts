'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { checkbox, field, formRecord, parseWith } from '@/lib/form'

// Students in the top year level are not promoted automatically: they leave through exit processing.
const TOP_YEAR_LEVEL = 13

// Loosely typed transaction client, as in setup/actions.ts, because Prisma 7 callback inference is limited here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransactionClient = any

export type RolloverResult = {
  success: boolean
  error?: string
  summary?: {
    year: number
    classesCopied: number
    teacherAssignments: number
    studentsPromoted: number
    studentsAtTopLevel: number
  }
}

/** Adds whole years to a date, keeping the month and day. */
function shiftYears(date: Date, years: number): Date {
  const copy = new Date(date.getTime())
  copy.setUTCFullYear(copy.getUTCFullYear() + years)
  return copy
}

const rolloverSchema = z.object({
  year: field.int('Year', 2000, 2100),
  startDate: field.date('Start date'),
  endDate: field.date('End date'),
})

/**
 * Starts a new academic year from the active one.
 *
 * - Creates the new year with its terms shifted forward by the year difference.
 * - Optionally copies the active year's classes and their teacher assignments.
 *   Students are not copied; they enrol again.
 * - Optionally moves each active student up one year level. Students in the top year level are left
 *   unchanged so they can go through exit processing.
 * - Makes the new year the active one.
 *
 * Everything runs in one transaction, so a failure changes nothing.
 */
export async function rolloverAcademicYearAction(formData: FormData): Promise<RolloverResult> {
  try {
    const user = await requireRole(['admin'])

    const raw = formRecord(formData)
    const parsed = parseWith(rolloverSchema, raw)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const { year, startDate, endDate } = parsed.data

    if (endDate <= startDate) return { success: false, error: 'The new year must end after it starts.' }
    if (!checkbox(raw.confirm)) {
      return { success: false, error: 'Tick the confirmation box to start the rollover.' }
    }
    const copyClasses = checkbox(raw.copyClasses)
    const promoteStudents = checkbox(raw.promoteStudents)

    const summary = await db.$transaction(async (tx: TransactionClient) => {
      const source = await tx.academicYear.findFirst({
        where: { active: true },
        include: {
          terms: { orderBy: { termNumber: 'asc' } },
          classes: { include: { teachers: true } },
        },
      })
      if (!source) throw new RolloverError('There is no active academic year to roll over from.')

      const existing = await tx.academicYear.findFirst({ where: { year } })
      if (existing) throw new RolloverError(`Academic year ${year} already exists.`)

      const diff = year - source.year
      if (diff <= 0) throw new RolloverError(`The new year must be after ${source.year}.`)

      // Create the new year, with its terms shifted forward. It becomes active below.
      const created = await tx.academicYear.create({
        data: {
          year,
          startDate,
          endDate,
          active: false,
          terms: {
            create: source.terms.map((t: { termNumber: number; name: string; startDate: Date; endDate: Date }) => ({
              termNumber: t.termNumber,
              name: t.name,
              startDate: shiftYears(t.startDate, diff),
              endDate: shiftYears(t.endDate, diff),
            })),
          },
        },
      })

      let classesCopied = 0
      let teacherAssignments = 0
      if (copyClasses) {
        for (const cls of source.classes) {
          const newClass = await tx.class.create({
            data: {
              academicYearId: created.id,
              name: cls.name,
              code: cls.code,
              subject: cls.subject,
              yearLevel: cls.yearLevel,
              roomId: cls.roomId,
              maxStudents: cls.maxStudents,
              description: cls.description,
              periodsPerWeek: cls.periodsPerWeek,
            },
          })
          classesCopied++
          for (const t of cls.teachers) {
            await tx.classTeacher.create({
              data: { classId: newClass.id, staffId: t.staffId, isPrimary: t.isPrimary },
            })
            teacherAssignments++
          }
        }
      }

      let studentsPromoted = 0
      let studentsAtTopLevel = 0
      if (promoteStudents) {
        const levels = await tx.student.groupBy({
          by: ['yearLevel'],
          where: { enrollmentStatus: 'active', yearLevel: { not: null } },
          _count: { _all: true },
        })
        // Highest level first: moving Year 7 to Year 8 before Year 8 is moved stops anyone moving twice.
        const ordered = (levels as { yearLevel: number | null; _count: { _all: number } }[])
          .filter(r => r.yearLevel != null)
          .sort((a, b) => (b.yearLevel as number) - (a.yearLevel as number))
        for (const row of ordered) {
          if (row.yearLevel == null) continue
          if (row.yearLevel >= TOP_YEAR_LEVEL) {
            studentsAtTopLevel += row._count._all
            continue
          }
          const result = await tx.student.updateMany({
            where: { enrollmentStatus: 'active', yearLevel: row.yearLevel },
            data: { yearLevel: row.yearLevel + 1 },
          })
          studentsPromoted += result.count
        }
      }

      await tx.academicYear.updateMany({ data: { active: false } })
      await tx.academicYear.update({ where: { id: created.id }, data: { active: true } })

      return {
        year,
        classesCopied,
        teacherAssignments,
        studentsPromoted,
        studentsAtTopLevel,
        createdId: created.id,
      }
    })

    await logAudit(
      user.id,
      'CREATE',
      'AcademicYear',
      `Rolled over to ${summary.year}: ${summary.classesCopied} class(es), ${summary.studentsPromoted} student(s) promoted`,
      summary.createdId,
    )
    revalidatePath('/settings')
    revalidatePath('/classes')
    revalidatePath('/students')

    return {
      success: true,
      summary: {
        year: summary.year,
        classesCopied: summary.classesCopied,
        teacherAssignments: summary.teacherAssignments,
        studentsPromoted: summary.studentsPromoted,
        studentsAtTopLevel: summary.studentsAtTopLevel,
      },
    }
  } catch (err) {
    if (err instanceof RolloverError) return { success: false, error: err.message }
    console.error('rolloverAcademicYearAction error:', err)
    return { success: false, error: 'The rollover could not be completed. No changes were made.' }
  }
}

class RolloverError extends Error {}

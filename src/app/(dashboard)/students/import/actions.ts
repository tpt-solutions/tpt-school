'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { nextStudentId, withIdRetry } from '@/lib/ids'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { field, parseWith } from '@/lib/form'

// Each row triggers a password hash, so cap the batch size to keep one request bounded.
const MAX_IMPORT_ROWS = 1000

// Checked on the server for every row: the browser preview is not a security boundary.
const studentRowSchema = z.object({
  firstName: field.required('First name', 100),
  lastName: field.required('Last name', 100),
  email: z
    .string({ message: 'Email is required.' })
    .trim()
    .max(254, { message: 'Email must be 254 characters or fewer.' })
    .pipe(z.email({ message: 'Email must be a valid email address.' })),
  dateOfBirth: field.optionalDate('Date of birth'),
  gender: field.optional('Gender', 30),
  yearLevel: field.optionalInt('Year level', 0, 20),
  enrollmentDate: field.optionalDate('Enrolment date'),
})

export type ImportStudentRow = {
  firstName: string
  lastName: string
  email: string
  dateOfBirth?: string
  gender?: string
  yearLevel?: string
  enrollmentDate?: string
}

export type ImportResult = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}


export async function importStudentsAction(rows: ImportStudentRow[]): Promise<ImportResult> {
  await requireRole(['admin'])

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, imported: 0, skipped: 0, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`] }
  }

  for (const raw of rows) {
    const parsed = parseWith(studentRowSchema, raw)
    if (!parsed.ok) {
      errors.push(`Row for ${raw?.email ?? '?'}: ${parsed.error}`)
      continue
    }
    const row = parsed.data
    try {
      const email = row.email.toLowerCase()
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) {
        skipped++
        continue
      }

      const name = `${row.firstName} ${row.lastName}`
      const tempPassword = randomBytes(9).toString('base64url').slice(0, 12)
      const passwordHash = await hashPassword(tempPassword)
      await withIdRetry(() => db.$transaction(async (tx) => {
        const studentId = await nextStudentId(tx)
        const user = await tx.user.create({
          data: { email, passwordHash, name, role: 'student', active: true },
        })
        await tx.student.create({
        data: {
          userId: user.id,
          studentId,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          yearLevel: row.yearLevel,
          enrollmentDate: row.enrollmentDate ?? new Date(),
        },
        })
      }))

      imported++
    } catch (err) {
      errors.push(`Row for ${row.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  revalidatePath('/students')
  return { success: true, imported, skipped, errors }
}

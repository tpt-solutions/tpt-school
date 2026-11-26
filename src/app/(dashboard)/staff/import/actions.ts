'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { nextEmployeeId, withIdRetry } from '@/lib/ids'
import { z } from 'zod'
import { field, parseWith } from '@/lib/form'

// Each row triggers a password hash, so cap the batch size to keep one request bounded.
const MAX_IMPORT_ROWS = 1000

// Checked on the server for every row: the browser preview is not a security boundary.
const staffRowSchema = z.object({
  firstName: field.required('First name', 100),
  lastName: field.required('Last name', 100),
  email: z
    .string({ message: 'Email is required.' })
    .trim()
    .max(254, { message: 'Email must be 254 characters or fewer.' })
    .pipe(z.email({ message: 'Email must be a valid email address.' })),
  jobTitle: field.optional('Job title', 100),
  department: field.optional('Department', 100),
  // A blank cell in the CSV means "not given", which defaults to full-time as before
  employmentType: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    field.oneOf('Employment type', ['full-time', 'part-time', 'casual', 'contract'] as const).default('full-time'),
  ),
  dateHired: field.optionalDate('Date hired'),
})
import { revalidatePath } from 'next/cache'

export type ImportStaffRow = {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  department?: string
  employmentType?: string
  dateHired?: string
}

export type ImportResult = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}


export async function importStaffAction(rows: ImportStaffRow[]): Promise<ImportResult> {
  await requireRole(['admin'])

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, imported: 0, skipped: 0, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`] }
  }

  for (const raw of rows) {
    const parsed = parseWith(staffRowSchema, raw)
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
        const employeeId = await nextEmployeeId(tx)
        const user = await tx.user.create({
          data: { email, passwordHash, name, role: 'teacher', active: true },
        })
        await tx.staff.create({
        data: {
          userId: user.id,
          employeeId,
          jobTitle: row.jobTitle,
          department: row.department,
          employmentType: row.employmentType,
          dateHired: row.dateHired,
        },
        })
      }))

      imported++
    } catch (err) {
      errors.push(`Row for ${row.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  revalidatePath('/staff')
  return { success: true, imported, skipped, errors }
}

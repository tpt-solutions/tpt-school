'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
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

async function generateEmployeeId(): Promise<string> {
  const count = await db.staff.count()
  return `EMP-${String(count + 1).padStart(4, '0')}`
}

export async function importStaffAction(rows: ImportStaffRow[]): Promise<ImportResult> {
  await requireRole(['admin'])

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const email = row.email.trim().toLowerCase()
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) {
        skipped++
        continue
      }

      const name = `${row.firstName.trim()} ${row.lastName.trim()}`
      const tempPassword = randomBytes(9).toString('base64url').slice(0, 12)
      const passwordHash = await hashPassword(tempPassword)
      const employeeId = await generateEmployeeId()

      const user = await db.user.create({
        data: { email, passwordHash, name, role: 'teacher', active: true },
      })

      await db.staff.create({
        data: {
          userId: user.id,
          employeeId,
          jobTitle: row.jobTitle || null,
          department: row.department || null,
          employmentType: row.employmentType || 'full-time',
          dateHired: row.dateHired ? new Date(row.dateHired) : null,
        },
      })

      imported++
    } catch (err) {
      errors.push(`Row for ${row.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  revalidatePath('/staff')
  return { success: true, imported, skipped, errors }
}

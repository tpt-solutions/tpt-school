'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

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

async function generateStudentId(): Promise<string> {
  const count = await db.student.count()
  return `STU-${String(count + 1).padStart(5, '0')}`
}

export async function importStudentsAction(rows: ImportStudentRow[]): Promise<ImportResult> {
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
      const studentId = await generateStudentId()

      const user = await db.user.create({
        data: { email, passwordHash, name, role: 'student', active: true },
      })

      await db.student.create({
        data: {
          userId: user.id,
          studentId,
          dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
          gender: row.gender || null,
          yearLevel: row.yearLevel ? parseInt(row.yearLevel, 10) : null,
          enrollmentDate: row.enrollmentDate ? new Date(row.enrollmentDate) : new Date(),
        },
      })

      imported++
    } catch (err) {
      errors.push(`Row for ${row.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  revalidatePath('/students')
  return { success: true, imported, skipped, errors }
}

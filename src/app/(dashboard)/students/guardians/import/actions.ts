'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { field, parseWith } from '@/lib/form'
import { queueAccountSetupEmail } from '@/lib/account-setup'

// Each new guardian needs a password hash, so cap the batch to keep one request bounded.
const MAX_IMPORT_ROWS = 1000

const TRUTHY = ['true', 'yes', 'y', '1']
const FALSY = ['', 'false', 'no', 'n', '0']

// Checked on the server for every row: the browser preview is not a security boundary.
const guardianRowSchema = z.object({
  studentId: field.required('Student ID', 30),
  email: z
    .string({ message: 'Email is required.' })
    .trim()
    .max(254, { message: 'Email must be 254 characters or fewer.' })
    .pipe(z.email({ message: 'Email must be a valid email address.' })),
  firstName: field.required('First name', 100),
  lastName: field.required('Last name', 100),
  phone: field.optional('Phone', 40),
  relationship: field.optional('Relationship', 60),
  isPrimary: z
    .string()
    .trim()
    .toLowerCase()
    .refine(v => TRUTHY.includes(v) || FALSY.includes(v), { message: 'isPrimary must be true or false.' }),
})

export type GuardianImportOutcome = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Creates or links guardian (parent) accounts from a CSV. A new account is created with a
 * random password that is not shown anywhere: the guardian sets their own via "Forgot password".
 * An existing parent account is linked to the student. Existing links are skipped.
 */
export async function importGuardiansAction(rows: Record<string, string>[]): Promise<GuardianImportOutcome> {
  const actor = await requireRole(['admin'])

  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, imported: 0, skipped: 0, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`] }
  }

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const raw of rows) {
    const parsed = parseWith(guardianRowSchema, raw)
    if (!parsed.ok) {
      errors.push(`Row for ${raw?.email ?? raw?.studentId ?? '?'}: ${parsed.error}`)
      continue
    }
    const row = parsed.data
    const email = row.email.toLowerCase()
    const isPrimary = TRUTHY.includes(row.isPrimary.toLowerCase())

    try {
      const student = await db.student.findUnique({ where: { studentId: row.studentId }, select: { id: true } })
      if (!student) {
        errors.push(`Row for ${email}: no student with ID ${row.studentId}.`)
        continue
      }

      const existingUser = await db.user.findUnique({
        where: { email },
        include: { parentProfile: { select: { id: true } } },
      })
      if (existingUser && existingUser.role !== 'parent') {
        errors.push(`Row for ${email}: this email belongs to a ${existingUser.role} account.`)
        continue
      }

      const outcome = await db.$transaction(async (tx) => {
        let parentId: string
        if (existingUser?.parentProfile) {
          parentId = existingUser.parentProfile.id
        } else if (existingUser) {
          // Parent role but no profile row yet: create the profile for the existing account
          const parent = await tx.parent.create({
            data: { userId: existingUser.id, relationship: row.relationship },
          })
          parentId = parent.id
        } else {
          const passwordHash = await hashPassword(randomBytes(18).toString('base64url'))
          const user = await tx.user.create({
            data: {
              email,
              passwordHash,
              name: `${row.firstName} ${row.lastName}`,
              role: 'parent',
              phone: row.phone,
              active: true,
            },
          })
          const parent = await tx.parent.create({
            data: { userId: user.id, relationship: row.relationship },
          })
          parentId = parent.id
        }

        const alreadyLinked = await tx.studentParent.findUnique({
          where: { studentId_parentId: { studentId: student.id, parentId } },
          select: { studentId: true },
        })
        if (alreadyLinked) return 'skipped' as const

        if (isPrimary) {
          await tx.studentParent.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } })
        }
        await tx.studentParent.create({ data: { studentId: student.id, parentId, isPrimary } })
        return 'imported' as const
      })

      if (outcome === 'skipped') {
        skipped++
      } else {
        imported++
        // Only brand-new accounts need a set-up email; an existing parent already has a password
        if (!existingUser) await queueAccountSetupEmail(email, `${row.firstName} ${row.lastName}`).catch(() => {})
      }
    } catch (err) {
      errors.push(`Row for ${email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  await logAudit(actor.id, 'CREATE', 'StudentParent', `Guardian import: ${imported} linked, ${skipped} already linked`)
  revalidatePath('/students')
  return { success: true, imported, skipped, errors }
}

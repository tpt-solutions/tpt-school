'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { field, formRecord, parseWith } from '@/lib/form'
import { checkPersonFields } from '@/lib/validation'

const guardianSchema = z.object({
  firstName: field.required('First name', 100),
  lastName: field.required('Last name', 100),
  email: field.required('Email', 254),
  phone: field.optional('Phone', 40),
  relationship: field.optional('Relationship', 60),
  occupation: field.optional('Occupation', 120),
  workPhone: field.optional('Work phone', 40),
})

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12)
}

export async function createAndLinkParentAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string; tempPassword?: string; parentName?: string }> {
  await requireRole(['admin'])

  const parsed = parseWith(guardianSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { firstName, lastName, phone, relationship, occupation, workPhone } = parsed.data
  const email = parsed.data.email.toLowerCase()
  const isPrimary = formData.get('isPrimary') === 'true'

  const emailError = checkPersonFields({ email })
  if (emailError) return { success: false, error: emailError }

  const student = await db.student.findUnique({ where: { id: studentId } })
  if (!student) return { success: false, error: 'Student not found.' }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return { success: false, error: 'A user with this email already exists. Use "link existing" instead.' }
  }

  try {
    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)
    const name = `${firstName} ${lastName}`

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name, role: 'parent', phone, active: true },
      })

      const parent = await tx.parent.create({
        data: { userId: user.id, relationship, occupation, workPhone },
      })

      // If setting as primary, clear existing primary flags first
      if (isPrimary) {
        await tx.studentParent.updateMany({
          where: { studentId },
          data: { isPrimary: false },
        })
      }

      await tx.studentParent.create({
        data: { studentId, parentId: parent.id, isPrimary },
      })
    })

    revalidatePath(`/students/${studentId}`)
    return { success: true, tempPassword, parentName: name }
  } catch {
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function linkExistingParentAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  const parsed = parseWith(z.object({ email: field.required('Email', 254) }), formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const email = parsed.data.email.toLowerCase()
  const isPrimary = formData.get('isPrimary') === 'true'

  const emailError = checkPersonFields({ email })
  if (emailError) return { success: false, error: emailError }

  const student = await db.student.findUnique({ where: { id: studentId } })
  if (!student) return { success: false, error: 'Student not found.' }

  const user = await db.user.findUnique({ where: { email }, include: { parentProfile: true } })
  if (!user) return { success: false, error: 'No user found with that email address.' }
  if (user.role !== 'parent' || !user.parentProfile) {
    return { success: false, error: 'That user does not have a parent account.' }
  }

  const alreadyLinked = await db.studentParent.findUnique({
    where: { studentId_parentId: { studentId, parentId: user.parentProfile.id } },
  })
  if (alreadyLinked) return { success: false, error: 'This parent is already linked to the student.' }

  try {
    if (isPrimary) {
      await db.studentParent.updateMany({ where: { studentId }, data: { isPrimary: false } })
    }
    await db.studentParent.create({
      data: { studentId, parentId: user.parentProfile.id, isPrimary },
    })
    revalidatePath(`/students/${studentId}`)
    return { success: true }
  } catch {
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function unlinkParentAction(
  studentId: string,
  parentId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  try {
    await db.studentParent.delete({
      where: { studentId_parentId: { studentId, parentId } },
    })
    revalidatePath(`/students/${studentId}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to unlink guardian.' }
  }
}

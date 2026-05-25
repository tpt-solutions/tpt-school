'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12)
}

export async function createAndLinkParentAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string; tempPassword?: string; parentName?: string }> {
  await requireRole(['admin'])

  const firstName = (formData.get('firstName') as string)?.trim()
  const lastName = (formData.get('lastName') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const phone = (formData.get('phone') as string)?.trim() || null
  const relationship = (formData.get('relationship') as string)?.trim() || null
  const occupation = (formData.get('occupation') as string)?.trim() || null
  const workPhone = (formData.get('workPhone') as string)?.trim() || null
  const isPrimary = formData.get('isPrimary') === 'true'

  if (!firstName || !lastName || !email) {
    return { success: false, error: 'First name, last name, and email are required.' }
  }

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

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const isPrimary = formData.get('isPrimary') === 'true'

  if (!email) return { success: false, error: 'Email is required.' }

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

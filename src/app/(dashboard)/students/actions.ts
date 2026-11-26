'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { nextStudentId, withIdRetry } from '@/lib/ids'
import { checkPersonFields } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12)
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createStudentAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string; tempPassword?: string }> {
  await requireRole(['admin'])

  try {
    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const dateOfBirthRaw = formData.get('dateOfBirth') as string
    const gender = (formData.get('gender') as string) || null
    const yearLevelRaw = formData.get('yearLevel') as string
    const nationality = (formData.get('nationality') as string)?.trim() || null
    const address = (formData.get('address') as string)?.trim() || null
    const enrollmentStatus = (formData.get('enrollmentStatus') as string) || 'active'
    const enrollmentDateRaw = formData.get('enrollmentDate') as string
    const medicalConditions = (formData.get('medicalConditions') as string)?.trim() || null
    const allergies = (formData.get('allergies') as string)?.trim() || null
    const medications = (formData.get('medications') as string)?.trim() || null
    const doctorName = (formData.get('doctorName') as string)?.trim() || null
    const doctorPhone = (formData.get('doctorPhone') as string)?.trim() || null
    const emergencyName = (formData.get('emergencyName') as string)?.trim() || null
    const emergencyPhone = (formData.get('emergencyPhone') as string)?.trim() || null
    const emergencyRelation = (formData.get('emergencyRelation') as string)?.trim() || null

    if (!firstName || !lastName || !email) {
      return { success: false, error: 'First name, last name, and email are required.' }
    }

    const fieldError = checkPersonFields({ email, dateOfBirth: dateOfBirthRaw, enrollmentDate: enrollmentDateRaw, yearLevel: yearLevelRaw })
    if (fieldError) return { success: false, error: fieldError }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return { success: false, error: 'A user with this email already exists.' }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)
    const name = `${firstName} ${lastName}`

    // User and profile are created in one transaction; the ID is read inside it and retried on collision
    const student = await withIdRetry(() => db.$transaction(async (tx) => {
      const studentId = await nextStudentId(tx)
      const user = await tx.user.create({
        data: { email, passwordHash, name, role: 'student', phone, active: true },
      })
      return tx.student.create({
      data: {
        userId: user.id,
        studentId,
        dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
        gender,
        yearLevel: yearLevelRaw ? parseInt(yearLevelRaw, 10) : null,
        nationality,
        address,
        enrollmentStatus,
        enrollmentDate: enrollmentDateRaw ? new Date(enrollmentDateRaw) : new Date(),
        medicalConditions,
        allergies,
        medications,
        doctorName,
        doctorPhone,
        emergencyName,
        emergencyPhone,
        emergencyRelation,
      },
      })
    }))

    revalidatePath('/students')
    return { success: true, id: student.id, tempPassword }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('createStudentAction error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateStudentAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  try {
    const student = await db.student.findUnique({ where: { id }, include: { user: true } })
    if (!student) return { success: false, error: 'Student not found.' }

    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const dateOfBirthRaw = formData.get('dateOfBirth') as string
    const gender = (formData.get('gender') as string) || null
    const yearLevelRaw = formData.get('yearLevel') as string
    const nationality = (formData.get('nationality') as string)?.trim() || null
    const address = (formData.get('address') as string)?.trim() || null
    const enrollmentStatus = (formData.get('enrollmentStatus') as string) || 'active'
    const enrollmentDateRaw = formData.get('enrollmentDate') as string
    const medicalConditions = (formData.get('medicalConditions') as string)?.trim() || null
    const allergies = (formData.get('allergies') as string)?.trim() || null
    const medications = (formData.get('medications') as string)?.trim() || null
    const doctorName = (formData.get('doctorName') as string)?.trim() || null
    const doctorPhone = (formData.get('doctorPhone') as string)?.trim() || null
    const emergencyName = (formData.get('emergencyName') as string)?.trim() || null
    const emergencyPhone = (formData.get('emergencyPhone') as string)?.trim() || null
    const emergencyRelation = (formData.get('emergencyRelation') as string)?.trim() || null

    if (!firstName || !lastName || !email) {
      return { success: false, error: 'First name, last name, and email are required.' }
    }

    const fieldError = checkPersonFields({ email, dateOfBirth: dateOfBirthRaw, enrollmentDate: enrollmentDateRaw, yearLevel: yearLevelRaw })
    if (fieldError) return { success: false, error: fieldError }

    // Check email uniqueness (excluding current user)
    if (email !== student.user.email) {
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) return { success: false, error: 'A user with this email already exists.' }
    }

    await db.user.update({
      where: { id: student.userId },
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phone,
      },
    })

    await db.student.update({
      where: { id },
      data: {
        dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
        gender,
        yearLevel: yearLevelRaw ? parseInt(yearLevelRaw, 10) : null,
        nationality,
        address,
        enrollmentStatus,
        enrollmentDate: enrollmentDateRaw ? new Date(enrollmentDateRaw) : student.enrollmentDate,
        medicalConditions,
        allergies,
        medications,
        doctorName,
        doctorPhone,
        emergencyName,
        emergencyPhone,
        emergencyRelation,
      },
    })

    revalidatePath('/students')
    revalidatePath(`/students/${id}`)
    redirect(`/students/${id}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('updateStudentAction error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Delete (soft) ───────────────────────────────────────────────────────────

export async function deleteStudentAction(id: string): Promise<{ success: boolean; error?: string }> {
  const actor = await requireRole(['admin'])

  try {
    const student = await db.student.findUnique({ where: { id } })
    if (!student) return { success: false, error: 'Student not found.' }

    await db.student.update({
      where: { id },
      data: { enrollmentStatus: 'inactive' },
    })

    await db.user.update({
      where: { id: student.userId },
      data: { active: false },
    })

    await logAudit(actor.id, 'DELETE', 'Student', 'Deactivated student account (soft delete)', id)
    revalidatePath('/students')
    return { success: true }
  } catch (err: unknown) {
    console.error('deleteStudentAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Bulk status ─────────────────────────────────────────────────────────────

/**
 * Deactivates or reactivates many students at once. Uses the same rules as the
 * single-student soft delete: the enrolment status and the login both change.
 * Used directly as a form action, so it returns nothing; failures are no-ops.
 */
export async function bulkSetStudentStatusAction(formData: FormData): Promise<void> {
  const actor = await requireRole(['admin'])

  const status = formData.get('status')
  if (status !== 'active' && status !== 'inactive') return

  const ids = formData
    .getAll('ids')
    .filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64)
    .slice(0, 200)
  if (ids.length === 0) return

  const students = await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true } })
  if (students.length === 0) return

  await db.$transaction([
    db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { enrollmentStatus: status } }),
    db.user.updateMany({ where: { id: { in: students.map((s) => s.userId) } }, data: { active: status === 'active' } }),
  ])

  await logAudit(actor.id, 'UPDATE', 'Student', `Bulk set ${students.length} student(s) to ${status}`)
  revalidatePath('/students')
}

// ─── Transfer In ─────────────────────────────────────────────────────────────

export async function recordTransferInAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const previousSchool = (formData.get('previousSchool') as string)?.trim()
  if (!previousSchool) return { success: false, error: 'Previous school is required.' }

  const transferDate = new Date(formData.get('transferDate') as string)
  const previousYearLevelRaw = formData.get('previousYearLevel') as string
  const previousYearLevel = previousYearLevelRaw ? parseInt(previousYearLevelRaw, 10) : null

  try {
    await db.studentTransferIn.upsert({
      where: { studentId },
      create: {
        studentId,
        previousSchool,
        previousYearLevel,
        transferDate,
        reason: (formData.get('reason') as string)?.trim() || null,
        documentsReceived: formData.get('documentsReceived') === 'on',
        academicRecordsNotes: (formData.get('academicRecordsNotes') as string)?.trim() || null,
        notes: (formData.get('notes') as string)?.trim() || null,
        processedBy: session.id,
      },
      update: {
        previousSchool,
        previousYearLevel,
        transferDate,
        reason: (formData.get('reason') as string)?.trim() || null,
        documentsReceived: formData.get('documentsReceived') === 'on',
        academicRecordsNotes: (formData.get('academicRecordsNotes') as string)?.trim() || null,
        notes: (formData.get('notes') as string)?.trim() || null,
        processedBy: session.id,
      },
    })
    revalidatePath(`/students/${studentId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('recordTransferInAction error:', err)
    return { success: false, error: 'Failed to save transfer record.' }
  }
}

// ─── Suggested Placement ─────────────────────────────────────────────────────

export async function getSuggestedClassesAction(studentId: string) {
  await requireRole(['admin'])

  const student = await db.student.findUnique({ where: { id: studentId }, select: { yearLevel: true } })
  if (!student?.yearLevel) return []

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })
  if (!activeYear) return []

  const classes = await db.class.findMany({
    where: {
      academicYearId: activeYear.id,
      yearLevel: student.yearLevel,
      enrolments: { none: { studentId, status: 'active' } },
    },
    include: {
      room: { select: { code: true } },
      teachers: {
        where: { isPrimary: true },
        include: { staff: { include: { user: { select: { name: true } } } } },
        take: 1,
      },
      _count: { select: { enrolments: true } },
    },
    orderBy: { subject: 'asc' },
  })

  return classes
    .filter(c => c.maxStudents === null || c._count.enrolments < c.maxStudents)
    .map(c => ({
      id: c.id,
      name: c.name,
      subject: c.subject ?? '',
      teacherName: c.teachers[0]?.staff.user.name ?? null,
      roomCode: c.room?.code ?? null,
      enrolled: c._count.enrolments,
      maxStudents: c.maxStudents,
    }))
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchStudentsAction(
  query: string,
  yearLevel?: string,
  status?: string,
) {
  await requireRole(['admin', 'teacher'])

  const students = await db.student.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { user: { name: { contains: query } } },
                { studentId: { contains: query } },
              ],
            }
          : {},
        yearLevel ? { yearLevel: parseInt(yearLevel, 10) } : {},
        status ? { enrollmentStatus: status } : {},
      ],
    },
    // Never return the user row wholesale: it includes passwordHash and session data
    include: { user: { select: { id: true, name: true, email: true, phone: true, active: true, avatar: true } } },
    orderBy: { enrollmentDate: 'desc' },
  })
  return students
}

'use server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { appendToWaitlistTx } from '@/lib/enrolment'

export async function submitEnrolmentRequestAction(
  classId: string,
  message?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'student' && session.role !== 'parent') {
    return { success: false, error: 'Only students and parents can submit enrollment requests.' }
  }

  let studentId: string | null = null

  if (session.role === 'student') {
    const student = await db.student.findUnique({ where: { userId: session.id } })
    if (!student) return { success: false, error: 'Student profile not found.' }
    studentId = student.id
  } else {
    // parent — use studentId from form
    return { success: false, error: 'Parent requests must specify a student.' }
  }

  if (message && message.trim().length > 1000) {
    return { success: false, error: 'Message must be 1000 characters or fewer.' }
  }
  if (!classId || classId.length > 64) return { success: false, error: 'Choose a class.' }
  const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } })
  if (!cls) return { success: false, error: 'That class could not be found.' }

  const existing = await db.enrolmentRequest.findUnique({
    where: { classId_studentId: { classId, studentId } },
  })
  if (existing) return { success: false, error: 'You already have a pending or processed request for this class.' }

  const alreadyEnrolled = await db.classEnrolment.findUnique({
    where: { classId_studentId: { classId, studentId } },
  })
  if (alreadyEnrolled) return { success: false, error: 'You are already enrolled in this class.' }

  await db.enrolmentRequest.create({
    data: { classId, studentId, requestedById: session.id, message: message?.trim() || null },
  })

  revalidatePath('/portal/enroll')
  return { success: true }
}

export async function submitParentEnrolmentRequestAction(
  classId: string,
  studentId: string,
  message?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'parent' && session.role !== 'admin') {
    return { success: false, error: 'Not authorized.' }
  }
  if (message && message.trim().length > 1000) {
    return { success: false, error: 'Message must be 1000 characters or fewer.' }
  }

  if (session.role === 'parent') {
    const parent = await db.parent.findUnique({
      where: { userId: session.id },
      include: { students: { where: { studentId } } },
    })
    if (!parent || parent.students.length === 0) {
      return { success: false, error: 'You are not linked to this student.' }
    }
  }

  const existing = await db.enrolmentRequest.findUnique({
    where: { classId_studentId: { classId, studentId } },
  })
  if (existing) return { success: false, error: 'A request already exists for this class.' }

  const alreadyEnrolled = await db.classEnrolment.findUnique({
    where: { classId_studentId: { classId, studentId } },
  })
  if (alreadyEnrolled) return { success: false, error: 'Student is already enrolled in this class.' }

  await db.enrolmentRequest.create({
    data: { classId, studentId, requestedById: session.id, message: message?.trim() || null },
  })

  revalidatePath('/portal/enroll')
  return { success: true }
}

export async function cancelEnrolmentRequestAction(
  classId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()

  let studentId: string | null = null
  if (session.role === 'student') {
    const student = await db.student.findUnique({ where: { userId: session.id } })
    studentId = student?.id ?? null
  }
  if (!studentId) return { success: false, error: 'Student profile not found.' }

  await db.enrolmentRequest.deleteMany({
    where: { classId, studentId, status: 'pending' },
  })

  revalidatePath('/portal/enroll')
  return { success: true }
}

export async function joinWaitlistAction(
  classId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'student') return { success: false, error: 'Only students can join the waitlist.' }
  if (!classId || classId.length > 64) return { success: false, error: 'Choose a class.' }

  const student = await db.student.findUnique({ where: { userId: session.id } })
  if (!student) return { success: false, error: 'Student profile not found.' }

  const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } })
  if (!cls) return { success: false, error: 'That class could not be found.' }

  const existing = await db.waitlistEntry.findUnique({
    where: { classId_studentId: { classId, studentId: student.id } },
  })
  if (existing) return { success: false, error: 'You are already on the waitlist for this class.' }

  try {
    // Position is assigned inside the transaction so concurrent joins get distinct positions
    await db.$transaction(tx => appendToWaitlistTx(tx, classId, student.id))
  } catch {
    // A double-submit trips the unique (classId, studentId) constraint
    return { success: false, error: 'You are already on the waitlist for this class.' }
  }
  revalidatePath('/portal/enroll')
  return { success: true }
}

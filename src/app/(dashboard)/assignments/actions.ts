'use server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function submitAssignmentAction(
  gradebookId: string,
  submissionUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'student') {
    return { success: false, error: 'Only students can submit assignments.' }
  }

  const student = await db.student.findUnique({ where: { userId: session.id } })
  if (!student) return { success: false, error: 'Student profile not found.' }

  const gradebook = await db.gradebook.findUnique({ where: { id: gradebookId } })
  if (!gradebook) return { success: false, error: 'Assignment not found.' }

  // Verify student is enrolled in the class
  const enrolment = await db.classEnrolment.findUnique({
    where: { classId_studentId: { classId: gradebook.classId, studentId: student.id } },
  })
  if (!enrolment || enrolment.status !== 'active') {
    return { success: false, error: 'You are not enrolled in this class.' }
  }

  await db.grade.upsert({
    where: { gradebookId_studentId: { gradebookId, studentId: student.id } },
    create: {
      gradebookId,
      studentId: student.id,
      submittedAt: new Date(),
      submissionUrl: submissionUrl?.trim() || null,
    },
    update: {
      submittedAt: new Date(),
      submissionUrl: submissionUrl?.trim() || null,
    },
  })

  revalidatePath('/assignments')
  return { success: true }
}

export async function unsubmitAssignmentAction(
  gradebookId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'student') return { success: false, error: 'Not authorized.' }

  const student = await db.student.findUnique({ where: { userId: session.id } })
  if (!student) return { success: false, error: 'Student profile not found.' }

  const grade = await db.grade.findUnique({
    where: { gradebookId_studentId: { gradebookId, studentId: student.id } },
  })
  if (!grade) return { success: true } // nothing to un-submit

  // Can't unsubmit if already graded
  if (grade.gradedAt) return { success: false, error: 'Cannot withdraw a submission that has already been graded.' }

  await db.grade.update({
    where: { gradebookId_studentId: { gradebookId, studentId: student.id } },
    data: { submittedAt: null, submissionUrl: null },
  })

  revalidatePath('/assignments')
  return { success: true }
}

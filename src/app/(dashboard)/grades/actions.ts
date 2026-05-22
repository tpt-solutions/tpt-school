'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createGradebookAction(formData: FormData) {
  const user = await requireRole(['admin', 'teacher'])

  const name = formData.get('name') as string
  const classId = formData.get('classId') as string
  const termId = formData.get('termId') as string
  const type = formData.get('type') as string
  const maxScore = formData.get('maxScore') ? Number(formData.get('maxScore')) : 100
  const weight = formData.get('weight') ? Number(formData.get('weight')) : 1
  const dueDateStr = formData.get('dueDate') as string
  const description = formData.get('description') as string

  if (!name || !classId || !termId) {
    return { error: 'Name, class, and term are required' }
  }

  // Teachers can only create gradebooks for their own classes
  if (user.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    if (!staff) return { error: 'Staff profile not found' }
    const isTeacher = await db.classTeacher.findFirst({ where: { classId, staffId: staff.id } })
    if (!isTeacher) return { error: 'You are not a teacher of this class' }
  }

  try {
    const gb = await db.gradebook.create({
      data: {
        name,
        classId,
        termId,
        type: type || 'assessment',
        maxScore,
        weight,
        dueDate: dueDateStr ? new Date(dueDateStr) : null,
        description: description || null,
      },
    })

    revalidatePath('/grades')
    redirect(`/grades/${gb.id}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create gradebook'
    return { error: msg }
  }
}

export interface GradeEntry {
  studentId: string
  score?: number | null
  grade?: string | null
  comment?: string | null
}

export async function saveGradesAction(gradebookId: string, grades: GradeEntry[]) {
  const user = await requireRole(['admin', 'teacher'])

  try {
    await Promise.all(
      grades.map((entry) =>
        db.grade.upsert({
          where: { gradebookId_studentId: { gradebookId, studentId: entry.studentId } },
          create: {
            gradebookId,
            studentId: entry.studentId,
            score: entry.score ?? null,
            grade: entry.grade || null,
            comment: entry.comment || null,
            gradedAt: entry.score != null ? new Date() : null,
            gradedById: entry.score != null ? user.id : null,
          },
          update: {
            score: entry.score ?? null,
            grade: entry.grade || null,
            comment: entry.comment || null,
            gradedAt: entry.score != null ? new Date() : null,
            gradedById: entry.score != null ? user.id : null,
          },
        })
      )
    )

    revalidatePath(`/grades/${gradebookId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save grades'
    return { error: msg }
  }
}

export async function updateGradeAction(
  gradeId: string,
  data: { score?: number | null; grade?: string | null; comment?: string | null }
) {
  const user = await requireRole(['admin', 'teacher'])

  try {
    await db.grade.update({
      where: { id: gradeId },
      data: {
        score: data.score ?? null,
        grade: data.grade || null,
        comment: data.comment || null,
        gradedAt: data.score != null ? new Date() : null,
        gradedById: data.score != null ? user.id : null,
      },
    })

    const grade = await db.grade.findUnique({ where: { id: gradeId } })
    if (grade) revalidatePath(`/grades/${grade.gradebookId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update grade'
    return { error: msg }
  }
}

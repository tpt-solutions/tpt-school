'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { teachesClass } from '@/lib/access'
import { logAudit } from '@/lib/audit'
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
  const documentUrl = (formData.get('documentUrl') as string)?.trim() || null

  if (!name || !classId || !termId) {
    return { error: 'Name, class, and term are required' }
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    return { error: 'Max score must be a positive number' }
  }
  if (!Number.isFinite(weight) || weight < 0) {
    return { error: 'Weight must be zero or a positive number' }
  }
  // Only http(s) links: rejects javascript:, data:, and other schemes
  if (documentUrl && !/^https?:\/\//i.test(documentUrl)) {
    return { error: 'Document link must start with http:// or https://' }
  }

  // Teachers can only create gradebooks for their own classes
  if (!(await teachesClass(user, classId))) {
    return { error: 'You are not a teacher of this class' }
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
        documentUrl,
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

  const gradebook = await db.gradebook.findUnique({
    where: { id: gradebookId },
    select: { classId: true, maxScore: true },
  })
  if (!gradebook) return { error: 'Gradebook not found' }
  if (!(await teachesClass(user, gradebook.classId))) {
    return { error: 'You are not a teacher of this class' }
  }

  for (const entry of grades) {
    if (entry.score != null && (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > gradebook.maxScore)) {
      return { error: `Scores must be between 0 and ${gradebook.maxScore}` }
    }
  }

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

    await logAudit(user.id, 'UPDATE', 'Gradebook', `Saved ${grades.length} grade(s)`, gradebookId)
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

  const existing = await db.grade.findUnique({
    where: { id: gradeId },
    include: { gradebook: { select: { classId: true, maxScore: true } } },
  })
  if (!existing) return { error: 'Grade not found' }
  if (!(await teachesClass(user, existing.gradebook.classId))) {
    return { error: 'You are not a teacher of this class' }
  }
  if (data.score != null && (!Number.isFinite(data.score) || data.score < 0 || data.score > existing.gradebook.maxScore)) {
    return { error: `Score must be between 0 and ${existing.gradebook.maxScore}` }
  }

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

    await logAudit(user.id, 'UPDATE', 'Grade', `Edited grade (score ${existing.score ?? 'none'} -> ${data.score ?? 'none'})`, gradeId)
    revalidatePath(`/grades/${existing.gradebookId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update grade'
    return { error: msg }
  }
}

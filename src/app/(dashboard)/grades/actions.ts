'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { teachesClass } from '@/lib/access'
import { logAudit } from '@/lib/audit'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const ASSESSMENT_TYPE_VALUES = ['assessment', 'exam', 'assignment', 'project'] as const

/** Decimal number as typed in a form, within [min, max], at most two decimal places. */
function decimal(label: string, min: number, max: number) {
  return z
    .string({ message: `${label} is required.` })
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, { message: `${label} must be a positive number.` })
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, { message: `${label} must be at least ${min}.` })
        .max(max, { message: `${label} must be ${max} or less.` }),
    )
}

/** Optional decimal: empty falls back to the default. */
function optionalDecimal(label: string, min: number, max: number, fallback: number) {
  return z
    .string()
    .trim()
    .nullish()
    .transform(v => (v ? v : String(fallback)))
    .pipe(decimal(label, min, max))
}

const gradebookSchema = z.object({
  name: field.required('Name', 120),
  classId: field.required('Class', 64),
  termId: field.required('Term', 64),
  type: z
    .string()
    .trim()
    .nullish()
    .transform(v => (v ? v : 'assessment'))
    .pipe(field.oneOf('Type', ASSESSMENT_TYPE_VALUES)),
  maxScore: optionalDecimal('Max score', 0.01, 10000, 100),
  weight: optionalDecimal('Weight', 0, 100, 1),
  dueDate: field.optionalDate('Due date'),
  description: field.optional('Description', 2000),
  documentUrl: field.optionalHttpUrl('Document link'),
})

const gradeEntrySchema = z.object({
  studentId: field.required('Student', 64),
  score: z.number().finite().min(0).max(10000).nullish(),
  grade: z.string().trim().max(10, { message: 'Grade must be 10 characters or fewer.' }).nullish(),
  comment: z.string().trim().max(2000, { message: 'Comment must be 2000 characters or fewer.' }).nullish(),
})

const saveGradesSchema = z.object({
  gradebookId: field.required('Gradebook', 64),
  grades: z.array(gradeEntrySchema).max(1000, { message: 'Too many grades in one save.' }),
})

const updateGradeSchema = z.object({
  gradeId: field.required('Grade', 64),
  score: z.number().finite().min(0).max(10000).nullish(),
  grade: z.string().trim().max(10, { message: 'Grade must be 10 characters or fewer.' }).nullish(),
  comment: z.string().trim().max(2000, { message: 'Comment must be 2000 characters or fewer.' }).nullish(),
})

export async function createGradebookAction(formData: FormData) {
  const user = await requireRole(['admin', 'teacher'])

  const parsed = parseWith(gradebookSchema, formRecord(formData))
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data

  // Teachers can only create gradebooks for their own classes
  if (!(await teachesClass(user, input.classId))) {
    return { error: 'You are not a teacher of this class' }
  }

  try {
    const gb = await db.gradebook.create({
      data: {
        name: input.name,
        classId: input.classId,
        termId: input.termId,
        type: input.type,
        maxScore: input.maxScore,
        weight: input.weight,
        dueDate: input.dueDate,
        description: input.description,
        documentUrl: input.documentUrl,
      },
    })

    revalidatePath('/grades')
    redirect(`/grades/${gb.id}`)
  } catch (e: unknown) {
    // redirect() throws to navigate; let it through
    if (e && typeof e === 'object' && 'digest' in e) throw e
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

  const parsed = parseWith(saveGradesSchema, { gradebookId, grades })
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data

  const gradebook = await db.gradebook.findUnique({
    where: { id: input.gradebookId },
    select: { classId: true, maxScore: true },
  })
  if (!gradebook) return { error: 'Gradebook not found' }
  if (!(await teachesClass(user, gradebook.classId))) {
    return { error: 'You are not a teacher of this class' }
  }

  for (const entry of input.grades) {
    if (entry.score != null && entry.score > gradebook.maxScore) {
      return { error: `Scores must be between 0 and ${gradebook.maxScore}` }
    }
  }

  try {
    await Promise.all(
      input.grades.map((entry) =>
        db.grade.upsert({
          where: { gradebookId_studentId: { gradebookId: input.gradebookId, studentId: entry.studentId } },
          create: {
            gradebookId: input.gradebookId,
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

    await logAudit(user.id, 'UPDATE', 'Gradebook', `Saved ${input.grades.length} grade(s)`, input.gradebookId)
    revalidatePath(`/grades/${input.gradebookId}`)
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

  const parsed = parseWith(updateGradeSchema, { gradeId, ...data })
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data

  const existing = await db.grade.findUnique({
    where: { id: input.gradeId },
    include: { gradebook: { select: { classId: true, maxScore: true } } },
  })
  if (!existing) return { error: 'Grade not found' }
  if (!(await teachesClass(user, existing.gradebook.classId))) {
    return { error: 'You are not a teacher of this class' }
  }
  if (input.score != null && input.score > existing.gradebook.maxScore) {
    return { error: `Score must be between 0 and ${existing.gradebook.maxScore}` }
  }

  try {
    await db.grade.update({
      where: { id: input.gradeId },
      data: {
        score: input.score ?? null,
        grade: input.grade || null,
        comment: input.comment || null,
        gradedAt: input.score != null ? new Date() : null,
        gradedById: input.score != null ? user.id : null,
      },
    })

    await logAudit(user.id, 'UPDATE', 'Grade', `Edited grade (score ${existing.score ?? 'none'} -> ${input.score ?? 'none'})`, input.gradeId)
    revalidatePath(`/grades/${existing.gradebookId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update grade'
    return { error: msg }
  }
}

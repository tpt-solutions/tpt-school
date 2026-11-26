'use server'

import { db } from '@/lib/db'
import { requireRole, requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { field, formRecord, parseWith } from '@/lib/form'

const eventSchema = z.object({
  title: field.required('Title', 200),
  description: field.optional('Description', 2000),
  startDate: field.date('Start date'),
  endDate: field.date('End date'),
  category: field.optional('Category', 50).transform(v => v ?? 'academic'),
  // Stored as "all" or a JSON array; the length cap stops oversized values
  targetRoles: field.optional('Audience', 200).transform(v => v ?? 'all'),
  targetYears: field.optional('Year levels', 200).transform(v => v ?? 'all'),
})

export async function createSchoolEventAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireRole(['admin'])

    const parsed = parseWith(eventSchema, formRecord(formData))
    if (!parsed.ok) return { success: false, error: parsed.error }
    const { title, description, startDate, endDate, category, targetRoles, targetYears } = parsed.data
    const allDay = formData.get('allDay') !== 'false'

    if (endDate < startDate) return { success: false, error: 'End date must be on or after start date.' }

    await db.schoolEvent.create({
      data: {
        title,
        description,
        startDate,
        endDate,
        allDay,
        category,
        targetRoles,
        targetYears,
        createdById: session.id,
      },
    })

    revalidatePath('/calendar')
    return { success: true }
  } catch (err) {
    console.error('createSchoolEventAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateSchoolEventAction(
  id: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const parsed = parseWith(eventSchema, formRecord(formData))
    if (!parsed.ok) return { success: false, error: parsed.error }
    const { title, description, startDate, endDate, category, targetRoles, targetYears } = parsed.data
    if (endDate < startDate) return { success: false, error: 'End date must be on or after start date.' }

    await db.schoolEvent.update({
      where: { id },
      data: {
        title,
        description,
        startDate,
        endDate,
        category,
        targetRoles,
        targetYears,
      },
    })

    revalidatePath('/calendar')
    return { success: true }
  } catch (err) {
    console.error('updateSchoolEventAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function deleteSchoolEventAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])
    await db.schoolEvent.delete({ where: { id } })
    revalidatePath('/calendar')
    return { success: true }
  } catch (err) {
    console.error('deleteSchoolEventAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

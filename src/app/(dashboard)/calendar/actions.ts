'use server'

import { db } from '@/lib/db'
import { requireRole, requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createSchoolEventAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireRole(['admin'])

    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string
    const allDay = formData.get('allDay') !== 'false'
    const category = (formData.get('category') as string) || 'academic'
    const targetRoles = (formData.get('targetRoles') as string) || 'all'
    const targetYears = (formData.get('targetYears') as string) || 'all'

    if (!title) return { success: false, error: 'Title is required.' }
    if (!startDateRaw || !endDateRaw) return { success: false, error: 'Start and end dates are required.' }

    const startDate = new Date(startDateRaw)
    const endDate = new Date(endDateRaw)
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

    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string
    const category = (formData.get('category') as string) || 'academic'
    const targetRoles = (formData.get('targetRoles') as string) || 'all'
    const targetYears = (formData.get('targetYears') as string) || 'all'

    if (!title) return { success: false, error: 'Title is required.' }

    await db.schoolEvent.update({
      where: { id },
      data: {
        title,
        description,
        startDate: new Date(startDateRaw),
        endDate: new Date(endDateRaw),
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

'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createClassAction(formData: FormData) {
  await requireRole(['admin'])

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const subject = formData.get('subject') as string
  const yearLevel = formData.get('yearLevel') ? Number(formData.get('yearLevel')) : null
  const maxStudents = formData.get('maxStudents') ? Number(formData.get('maxStudents')) : null
  const description = formData.get('description') as string
  const roomId = formData.get('roomId') as string || null
  const academicYearId = formData.get('academicYearId') as string
  const staffId = formData.get('staffId') as string || null

  if (!name || !code || !academicYearId) {
    return { error: 'Name, code, and academic year are required' }
  }

  try {
    const cls = await db.class.create({
      data: {
        name,
        code,
        subject: subject || null,
        yearLevel,
        maxStudents,
        description: description || null,
        roomId,
        academicYearId,
      },
    })

    if (staffId) {
      await db.classTeacher.create({
        data: { classId: cls.id, staffId, isPrimary: true },
      })
    }

    revalidatePath('/classes')
    redirect('/classes')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create class'
    if (msg.includes('Unique constraint')) return { error: 'Class code already exists for this year' }
    return { error: msg }
  }
}

export async function updateClassAction(id: string, formData: FormData) {
  await requireRole(['admin'])

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const subject = formData.get('subject') as string
  const yearLevel = formData.get('yearLevel') ? Number(formData.get('yearLevel')) : null
  const maxStudents = formData.get('maxStudents') ? Number(formData.get('maxStudents')) : null
  const description = formData.get('description') as string
  const roomId = formData.get('roomId') as string || null
  const academicYearId = formData.get('academicYearId') as string
  const staffId = formData.get('staffId') as string || null

  if (!name || !code || !academicYearId) {
    return { error: 'Name, code, and academic year are required' }
  }

  try {
    await db.class.update({
      where: { id },
      data: {
        name,
        code,
        subject: subject || null,
        yearLevel,
        maxStudents,
        description: description || null,
        roomId,
        academicYearId,
      },
    })

    if (staffId) {
      await db.classTeacher.upsert({
        where: { classId_staffId: { classId: id, staffId } },
        create: { classId: id, staffId, isPrimary: true },
        update: { isPrimary: true },
      })
    }

    revalidatePath('/classes')
    revalidatePath(`/classes/${id}`)
    redirect(`/classes/${id}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update class'
    return { error: msg }
  }
}

export async function enrollStudentAction(classId: string, studentId: string) {
  await requireRole(['admin'])

  try {
    await db.classEnrolment.create({
      data: { classId, studentId, status: 'active' },
    })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to enrol student'
    if (msg.includes('Unique constraint')) return { error: 'Student is already enrolled in this class' }
    return { error: msg }
  }
}

export async function unenrolStudentAction(classId: string, studentId: string) {
  await requireRole(['admin'])

  try {
    await db.classEnrolment.delete({
      where: { classId_studentId: { classId, studentId } },
    })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to unenrol student'
    return { error: msg }
  }
}

export async function assignTeacherAction(classId: string, staffId: string, isPrimary: boolean) {
  await requireRole(['admin'])

  try {
    if (isPrimary) {
      // Unset any existing primary teacher
      await db.classTeacher.updateMany({
        where: { classId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    await db.classTeacher.upsert({
      where: { classId_staffId: { classId, staffId } },
      create: { classId, staffId, isPrimary },
      update: { isPrimary },
    })

    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to assign teacher'
    return { error: msg }
  }
}

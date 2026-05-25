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

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export async function addToWaitlistAction(
  classId: string,
  studentId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  const existing = await db.waitlistEntry.findUnique({ where: { classId_studentId: { classId, studentId } } })
  if (existing) return { success: false, error: 'Student is already on the waitlist.' }

  const enrolled = await db.classEnrolment.findUnique({ where: { classId_studentId: { classId, studentId } } })
  if (enrolled) return { success: false, error: 'Student is already enrolled in this class.' }

  const lastEntry = await db.waitlistEntry.findFirst({ where: { classId }, orderBy: { position: 'desc' } })
  const position = (lastEntry?.position ?? 0) + 1

  try {
    await db.waitlistEntry.create({ data: { classId, studentId, position, notes: notes || null } })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to add to waitlist.' }
  }
}

export async function removeFromWaitlistAction(
  entryId: string,
  classId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  try {
    await db.waitlistEntry.delete({ where: { id: entryId } })
    // Re-number remaining entries
    const remaining = await db.waitlistEntry.findMany({ where: { classId }, orderBy: { position: 'asc' } })
    for (let i = 0; i < remaining.length; i++) {
      await db.waitlistEntry.update({ where: { id: remaining[i].id }, data: { position: i + 1 } })
    }
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to remove from waitlist.' }
  }
}

export async function promoteFromWaitlistAction(
  entryId: string,
  classId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  const entry = await db.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry) return { success: false, error: 'Waitlist entry not found.' }

  try {
    await db.$transaction([
      db.classEnrolment.create({ data: { classId, studentId: entry.studentId, status: 'active' } }),
      db.waitlistEntry.delete({ where: { id: entryId } }),
    ])
    // Re-number remaining
    const remaining = await db.waitlistEntry.findMany({ where: { classId }, orderBy: { position: 'asc' } })
    for (let i = 0; i < remaining.length; i++) {
      await db.waitlistEntry.update({ where: { id: remaining[i].id }, data: { position: i + 1 } })
    }
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to promote from waitlist'
    if (msg.includes('Unique constraint')) return { success: false, error: 'Student is already enrolled.' }
    return { success: false, error: msg }
  }
}

// ─── Enrolment Requests ───────────────────────────────────────────────────────

export async function approveEnrolmentRequestAction(
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const request = await db.enrolmentRequest.findUnique({ where: { id: requestId } })
  if (!request) return { success: false, error: 'Request not found.' }
  if (request.status !== 'pending') return { success: false, error: 'Request is no longer pending.' }

  try {
    await db.$transaction([
      db.classEnrolment.create({ data: { classId: request.classId, studentId: request.studentId, status: 'active' } }),
      db.enrolmentRequest.update({
        where: { id: requestId },
        data: { status: 'approved', reviewedById: session.id, reviewedAt: new Date() },
      }),
    ])
    revalidatePath(`/classes/${request.classId}`)
    revalidatePath('/enrollment-requests')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to approve request'
    if (msg.includes('Unique constraint')) return { success: false, error: 'Student is already enrolled.' }
    return { success: false, error: msg }
  }
}

export async function rejectEnrolmentRequestAction(
  requestId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const request = await db.enrolmentRequest.findUnique({ where: { id: requestId } })
  if (!request) return { success: false, error: 'Request not found.' }

  await db.enrolmentRequest.update({
    where: { id: requestId },
    data: { status: 'rejected', rejectionReason: reason || null, reviewedById: session.id, reviewedAt: new Date() },
  })
  revalidatePath(`/classes/${request.classId}`)
  revalidatePath('/enrollment-requests')
  return { success: true }
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

'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ClassFullError, appendToWaitlistTx, enrolInTx, renumberWaitlistTx } from '@/lib/enrolment'
import { z } from 'zod'
import { field, formRecord, parseWith } from '@/lib/form'

const classSchema = z.object({
  name: field.required('Class name', 150),
  code: field.required('Class code', 30),
  subject: field.optional('Subject', 100),
  yearLevel: field.optionalInt('Year level', 0, 20),
  maxStudents: field.optionalInt('Max students', 1, 1000),
  description: field.optional('Description', 2000),
  roomId: field.optional('Room', 64),
  academicYearId: field.required('Academic year', 64),
  staffId: field.optional('Teacher', 64),
})

export async function createClassAction(formData: FormData) {
  await requireRole(['admin'])

  const parsed = parseWith(classSchema, formRecord(formData))
  if (!parsed.ok) return { error: parsed.error }
  const { name, code, subject, yearLevel, maxStudents, description, roomId, academicYearId, staffId } = parsed.data

  try {
    const cls = await db.class.create({
      data: {
        name,
        code,
        subject,
        yearLevel,
        maxStudents,
        description,
        roomId,
        academicYearId,
      },
    })

    if (staffId) {
      await db.classTeacher.create({
        data: { classId: cls.id, staffId, isPrimary: true },
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Unique constraint')) return { error: 'Class code already exists for this year' }
    console.error('createClassAction error:', e)
    return { error: 'Failed to create class' }
  }

  revalidatePath('/classes')
  // redirect() throws to unwind, so it must stay outside the try/catch above.
  redirect('/classes')
}

export async function updateClassAction(id: string, formData: FormData) {
  await requireRole(['admin'])

  const parsed = parseWith(classSchema, formRecord(formData))
  if (!parsed.ok) return { error: parsed.error }
  const { name, code, subject, yearLevel, maxStudents, description, roomId, academicYearId, staffId } = parsed.data

  try {
    await db.class.update({
      where: { id },
      data: {
        name,
        code,
        subject,
        yearLevel,
        maxStudents,
        description,
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Unique constraint')) return { error: 'Class code already exists for this year' }
    console.error('updateClassAction error:', e)
    return { error: 'Failed to update class' }
  }

  revalidatePath('/classes')
  revalidatePath(`/classes/${id}`)
  // redirect() throws to unwind, so it must stay outside the try/catch above.
  redirect(`/classes/${id}`)
}

export async function enrollStudentAction(classId: string, studentId: string) {
  await requireRole(['admin'])

  try {
    await db.$transaction(tx => enrolInTx(tx, classId, studentId))
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    if (e instanceof ClassFullError) return { error: e.message }
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

  try {
    // Position is assigned inside the transaction so concurrent joins get distinct positions
    await db.$transaction(tx => appendToWaitlistTx(tx, classId, studentId, notes || null))
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
    await db.$transaction(async tx => {
      await tx.waitlistEntry.delete({ where: { id: entryId } })
      await renumberWaitlistTx(tx, classId)
    })
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
    await db.$transaction(async tx => {
      await enrolInTx(tx, classId, entry.studentId)
      await tx.waitlistEntry.delete({ where: { id: entryId } })
      await renumberWaitlistTx(tx, classId)
    })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    if (e instanceof ClassFullError) return { success: false, error: e.message }
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
    await db.$transaction(async tx => {
      await enrolInTx(tx, request.classId, request.studentId)
      await tx.enrolmentRequest.update({
        where: { id: requestId },
        data: { status: 'approved', reviewedById: session.id, reviewedAt: new Date() },
      })
    })
    revalidatePath(`/classes/${request.classId}`)
    revalidatePath('/enrollment-requests')
    return { success: true }
  } catch (e: unknown) {
    if (e instanceof ClassFullError) return { success: false, error: e.message }
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

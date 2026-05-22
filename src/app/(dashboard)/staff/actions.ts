'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendEmail, leaveDecisionEmailHtml } from '@/lib/email'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateEmployeeId(): Promise<string> {
  const count = await db.staff.count()
  return `EMP-${String(count + 1).padStart(4, '0')}`
}

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12)
}

// ─── Create Staff ─────────────────────────────────────────────────────────────

export async function createStaffAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string; tempPassword?: string }> {
  try {
    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const jobTitle = (formData.get('jobTitle') as string)?.trim() || null
    const department = (formData.get('department') as string)?.trim() || null
    const employmentType = (formData.get('employmentType') as string) || 'full-time'
    const dateHiredRaw = formData.get('dateHired') as string
    const bio = (formData.get('bio') as string)?.trim() || null
    const qualifications = (formData.get('qualifications') as string)?.trim() || null

    if (!firstName || !lastName || !email) {
      return { success: false, error: 'First name, last name, and email are required.' }
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return { success: false, error: 'A user with this email already exists.' }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)
    const employeeId = await generateEmployeeId()
    const name = `${firstName} ${lastName}`

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'teacher',
        phone,
        active: true,
      },
    })

    const staff = await db.staff.create({
      data: {
        userId: user.id,
        employeeId,
        jobTitle,
        department,
        employmentType,
        dateHired: dateHiredRaw ? new Date(dateHiredRaw) : null,
        bio,
        qualifications,
      },
    })

    revalidatePath('/staff')
    return { success: true, id: staff.id, tempPassword }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('createStaffAction error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Update Staff ─────────────────────────────────────────────────────────────

export async function updateStaffAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const staff = await db.staff.findUnique({ where: { id }, include: { user: true } })
    if (!staff) return { success: false, error: 'Staff member not found.' }

    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const jobTitle = (formData.get('jobTitle') as string)?.trim() || null
    const department = (formData.get('department') as string)?.trim() || null
    const employmentType = (formData.get('employmentType') as string) || 'full-time'
    const dateHiredRaw = formData.get('dateHired') as string
    const bio = (formData.get('bio') as string)?.trim() || null
    const qualifications = (formData.get('qualifications') as string)?.trim() || null

    if (!firstName || !lastName || !email) {
      return { success: false, error: 'First name, last name, and email are required.' }
    }

    if (email !== staff.user.email) {
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) return { success: false, error: 'A user with this email already exists.' }
    }

    await db.user.update({
      where: { id: staff.userId },
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phone,
      },
    })

    await db.staff.update({
      where: { id },
      data: {
        jobTitle,
        department,
        employmentType,
        dateHired: dateHiredRaw ? new Date(dateHiredRaw) : null,
        bio,
        qualifications,
      },
    })

    revalidatePath('/staff')
    revalidatePath(`/staff/${id}`)
    redirect(`/staff/${id}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('updateStaffAction error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function createLeaveRequestAction(
  staffId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const type = (formData.get('type') as string)?.trim()
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string
    const reason = (formData.get('reason') as string)?.trim() || null

    if (!type || !startDateRaw || !endDateRaw) {
      return { success: false, error: 'Leave type, start date, and end date are required.' }
    }

    const startDate = new Date(startDateRaw)
    const endDate = new Date(endDateRaw)

    if (endDate < startDate) {
      return { success: false, error: 'End date cannot be before start date.' }
    }

    await db.leaveRequest.create({
      data: {
        staffId,
        type,
        startDate,
        endDate,
        reason,
        status: 'pending',
      },
    })

    revalidatePath(`/staff/${staffId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('createLeaveRequestAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateLeaveStatusAction(
  leaveId: string,
  status: string,
  approvedBy: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const leave = await db.leaveRequest.findUnique({ where: { id: leaveId } })
    if (!leave) return { success: false, error: 'Leave request not found.' }

    await db.leaveRequest.update({
      where: { id: leaveId },
      data: { status, approvedBy },
    })

    // Fire-and-forget notification to staff member
    if (status === 'approved' || status === 'declined') {
      db.staff.findUnique({
        where: { id: leave.staffId },
        include: { user: { select: { name: true, email: true } } },
      }).then(staff => {
        if (!staff?.user?.email) return
        db.schoolSettings.findFirst().then(settings => {
          sendEmail({
            to: staff.user!.email,
            subject: `Leave request ${status} — ${settings?.name ?? 'School'}`,
            html: leaveDecisionEmailHtml(staff.user!.name, status, leave.type, leave.startDate, leave.endDate, settings?.name ?? 'School'),
          }).catch(() => {})
        }).catch(() => {})
      }).catch(() => {})
    }

    revalidatePath(`/staff/${leave.staffId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('updateLeaveStatusAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

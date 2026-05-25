'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoomAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim().toUpperCase()
  const type = (formData.get('type') as string)?.trim() || null
  const building = (formData.get('building') as string)?.trim() || null
  const floor = (formData.get('floor') as string)?.trim() || null
  const capacityRaw = formData.get('capacity') as string
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null

  if (!name || !code) return { success: false, error: 'Name and code are required.' }

  const existing = await db.room.findFirst({ where: { OR: [{ name }, { code }] } })
  if (existing) return { success: false, error: 'A room with that name or code already exists.' }

  try {
    await db.room.create({ data: { name, code, type, building, floor, capacity } })
    revalidatePath('/settings')
    revalidatePath('/timetable')
    return { success: true }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateRoomAction(
  id: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim().toUpperCase()
  const type = (formData.get('type') as string)?.trim() || null
  const building = (formData.get('building') as string)?.trim() || null
  const floor = (formData.get('floor') as string)?.trim() || null
  const capacityRaw = formData.get('capacity') as string
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null

  if (!name || !code) return { success: false, error: 'Name and code are required.' }

  const dup = await db.room.findFirst({ where: { OR: [{ name }, { code }], NOT: { id } } })
  if (dup) return { success: false, error: 'Another room with that name or code exists.' }

  try {
    await db.room.update({ where: { id }, data: { name, code, type, building, floor, capacity } })
    revalidatePath('/settings')
    revalidatePath('/timetable')
    return { success: true }
  } catch {
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function deleteRoomAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])
  try {
    await db.room.delete({ where: { id } })
    revalidatePath('/settings')
    revalidatePath('/timetable')
    return { success: true }
  } catch {
    return { success: false, error: 'Cannot delete a room that is assigned to classes or timetable slots.' }
  }
}

// ─── School Settings ──────────────────────────────────────────────────────────

export async function updateSchoolSettingsAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const data = {
      name: (formData.get('name') as string)?.trim() || '',
      shortName: (formData.get('shortName') as string)?.trim() || null,
      address: (formData.get('address') as string)?.trim() || null,
      phone: (formData.get('phone') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      website: (formData.get('website') as string)?.trim() || null,
      schoolType: (formData.get('schoolType') as string)?.trim() || undefined,
      timezone: (formData.get('timezone') as string)?.trim() || 'UTC',
      currencyCode: (formData.get('currencyCode') as string)?.trim() || 'USD',
      currencySymbol: (formData.get('currencySymbol') as string)?.trim() || '$',
    }

    if (!data.name) return { success: false, error: 'School name is required.' }

    const existing = await db.schoolSettings.findFirst()
    if (existing) {
      await db.schoolSettings.update({ where: { id: existing.id }, data })
    } else {
      await db.schoolSettings.create({
        data: { ...data, setupComplete: true, currentYear: new Date().getFullYear() },
      })
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateSchoolSettingsAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Academic Years ───────────────────────────────────────────────────────────

export async function createAcademicYearAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const yearRaw = formData.get('year') as string
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string

    if (!yearRaw || !startDateRaw || !endDateRaw) {
      return { success: false, error: 'Year, start date, and end date are required.' }
    }

    const year = parseInt(yearRaw, 10)
    const startDate = new Date(startDateRaw)
    const endDate = new Date(endDateRaw)

    if (endDate <= startDate) {
      return { success: false, error: 'End date must be after start date.' }
    }

    const existing = await db.academicYear.findFirst({ where: { year } })
    if (existing) return { success: false, error: `Academic year ${year} already exists.` }

    // Calculate 4 equal terms
    const totalMs = endDate.getTime() - startDate.getTime()
    const termMs = totalMs / 4

    const academicYear = await db.academicYear.create({
      data: {
        year,
        startDate,
        endDate,
        active: false,
        terms: {
          create: [1, 2, 3, 4].map(termNumber => {
            const tStart = new Date(startDate.getTime() + (termNumber - 1) * termMs)
            const tEnd = new Date(startDate.getTime() + termNumber * termMs - 1)
            return {
              termNumber,
              name: `Term ${termNumber}`,
              startDate: tStart,
              endDate: tEnd,
            }
          }),
        },
      },
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('createAcademicYearAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function setActiveYearAction(
  yearId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    await db.$transaction([
      db.academicYear.updateMany({ data: { active: false } }),
      db.academicYear.update({ where: { id: yearId }, data: { active: true } }),
    ])

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('setActiveYearAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function createTermAction(
  academicYearId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const termNumberRaw = formData.get('termNumber') as string
    const name = (formData.get('name') as string)?.trim()
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string

    if (!termNumberRaw || !name || !startDateRaw || !endDateRaw) {
      return { success: false, error: 'All term fields are required.' }
    }

    await db.term.create({
      data: {
        academicYearId,
        termNumber: parseInt(termNumberRaw, 10),
        name,
        startDate: new Date(startDateRaw),
        endDate: new Date(endDateRaw),
      },
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('createTermAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateTermAction(
  termId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const name = (formData.get('name') as string)?.trim()
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string

    if (!name || !startDateRaw || !endDateRaw) {
      return { success: false, error: 'All term fields are required.' }
    }

    const startDate = new Date(startDateRaw)
    const endDate = new Date(endDateRaw)
    if (endDate <= startDate) {
      return { success: false, error: 'End date must be after start date.' }
    }

    await db.term.update({
      where: { id: termId },
      data: { name, startDate, endDate },
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateTermAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── SMTP ─────────────────────────────────────────────────────────────────────

export async function updateSmtpAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const smtpHost = (formData.get('smtpHost') as string)?.trim() || null
    const smtpPortRaw = formData.get('smtpPort') as string
    const smtpUser = (formData.get('smtpUser') as string)?.trim() || null
    const smtpPass = (formData.get('smtpPass') as string)?.trim() || null
    const smtpFrom = (formData.get('smtpFrom') as string)?.trim() || null

    const smtpPort = smtpPortRaw ? parseInt(smtpPortRaw, 10) : null

    // Encrypt the password before storing — leave null/empty as-is
    const encryptedPass = smtpPass ? encrypt(smtpPass) : null

    const existing = await db.schoolSettings.findFirst()
    if (existing) {
      await db.schoolSettings.update({
        where: { id: existing.id },
        data: { smtpHost, smtpPort, smtpUser, smtpPass: encryptedPass, smtpFrom },
      })
    } else {
      return { success: false, error: 'School settings not found. Complete setup first.' }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateSmtpAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function testSmtpAction(
  toEmail: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])
    const settings = await db.schoolSettings.findFirst()
    if (!settings) return { success: false, error: 'School settings not found.' }

    const { sendEmail } = await import('@/lib/email')
    return sendEmail({
      to: toEmail,
      subject: `Test email from ${settings.name}`,
      html: `<p>This is a test email from <strong>${settings.name}</strong> school management system.</p>`,
      text: `This is a test email from ${settings.name} school management system.`,
    })
  } catch (err: unknown) {
    console.error('testSmtpAction error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to send test email.'
    return { success: false, error: msg }
  }
}

// ─── Email Provider ───────────────────────────────────────────────────────────

export async function updateEmailProviderAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])
    const { encrypt } = await import('@/lib/crypto')

    const emailProvider = (formData.get('emailProvider') as string) || 'smtp'
    const resendApiKey = (formData.get('resendApiKey') as string)?.trim() || null
    const mailjetApiKey = (formData.get('mailjetApiKey') as string)?.trim() || null
    const mailjetSecret = (formData.get('mailjetSecret') as string)?.trim() || null
    const sendgridApiKey = (formData.get('sendgridApiKey') as string)?.trim() || null

    const existing = await db.schoolSettings.findFirst()
    if (!existing) return { success: false, error: 'School settings not found.' }

    await db.schoolSettings.update({
      where: { id: existing.id },
      data: {
        emailProvider,
        resendApiKey: resendApiKey ? encrypt(resendApiKey) : null,
        mailjetApiKey: mailjetApiKey ? encrypt(mailjetApiKey) : null,
        mailjetSecret: mailjetSecret ? encrypt(mailjetSecret) : null,
        sendgridApiKey: sendgridApiKey ? encrypt(sendgridApiKey) : null,
      },
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateEmailProviderAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── AI Connection Test ───────────────────────────────────────────────────────

export async function testAiConnectionAction(): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])
    const { testAiConnection } = await import('@/lib/ai')
    return testAiConnection()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Test failed.' }
  }
}

// ─── AI Provider ─────────────────────────────────────────────────────────────

export async function updateAiProviderAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])
    const { encrypt } = await import('@/lib/crypto')

    const aiProvider = (formData.get('aiProvider') as string) || 'none'
    const aiApiKey = (formData.get('aiApiKey') as string)?.trim() || null
    const aiModel = (formData.get('aiModel') as string)?.trim() || null
    const aiBaseUrl = (formData.get('aiBaseUrl') as string)?.trim() || null
    const aiReportMode = (formData.get('aiReportMode') as string) || 'assist'

    const existing = await db.schoolSettings.findFirst()
    if (!existing) return { success: false, error: 'School settings not found.' }

    await db.schoolSettings.update({
      where: { id: existing.id },
      data: {
        aiProvider,
        aiApiKey: aiApiKey ? encrypt(aiApiKey) : null,
        aiModel,
        aiBaseUrl,
        aiReportMode,
      },
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateAiProviderAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

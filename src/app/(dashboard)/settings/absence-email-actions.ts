'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** Turns same-day absence emails to guardians on or off. Off by default. */
export async function updateAbsenceEmailSettingAction(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole(['admin'])
    const existing = await db.schoolSettings.findFirst({ select: { id: true, absenceEmailsEnabled: true } })
    if (!existing) return { success: false, error: 'School settings not found.' }

    await db.schoolSettings.update({
      where: { id: existing.id },
      data: { absenceEmailsEnabled: enabled },
    })
    await logAudit(
      user.id,
      'UPDATE',
      'SchoolSettings',
      `Absence emails to guardians ${enabled ? 'turned on' : 'turned off'}`,
      existing.id,
    )
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateAbsenceEmailSettingAction error:', err)
    return { success: false, error: 'Failed to update settings.' }
  }
}

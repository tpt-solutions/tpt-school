'use server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransactionClient = any

import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

type SchoolInfo = {
  name: string
  shortName: string
  address: string
  phone: string
  email: string
  schoolType: string
  currentYear: string
}

class SetupError extends Error {}

type AdminInfo = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export async function completeSetupAction(
  schoolInfo: SchoolInfo,
  adminInfo: AdminInfo
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate
    if (!schoolInfo.name?.trim()) return { success: false, error: 'School name is required.' }
    if (!adminInfo.name?.trim()) return { success: false, error: 'Admin name is required.' }
    if (!adminInfo.email?.trim()) return { success: false, error: 'Admin email is required.' }
    if (!adminInfo.password || adminInfo.password.length < 8)
      return { success: false, error: 'Password must be at least 8 characters.' }
    if (adminInfo.password !== adminInfo.confirmPassword)
      return { success: false, error: 'Passwords do not match.' }

    const passwordHash = await hashPassword(adminInfo.password)

    // The "already set up" and duplicate checks must happen inside the same
    // transaction as the writes, otherwise two concurrent submissions can both pass.
    await db.$transaction(async (tx: TransactionClient) => {
      const existing = await tx.schoolSettings.findFirst()
      if (existing?.setupComplete) throw new SetupError('Setup has already been completed.')

      const existingUser = await tx.user.findUnique({
        where: { email: adminInfo.email.trim().toLowerCase() },
      })
      if (existingUser) throw new SetupError('An account with this email already exists.')

      // Create or update SchoolSettings
      if (existing) {
        await tx.schoolSettings.update({
          where: { id: existing.id },
          data: {
            name: schoolInfo.name.trim(),
            shortName: schoolInfo.shortName?.trim() || null,
            address: schoolInfo.address?.trim() || null,
            phone: schoolInfo.phone?.trim() || null,
            email: schoolInfo.email?.trim().toLowerCase() || null,
            schoolType: schoolInfo.schoolType,
            currentYear: parseInt(schoolInfo.currentYear, 10),
            setupComplete: true,
          },
        })
      } else {
        await tx.schoolSettings.create({
          data: {
            name: schoolInfo.name.trim(),
            shortName: schoolInfo.shortName?.trim() || null,
            address: schoolInfo.address?.trim() || null,
            phone: schoolInfo.phone?.trim() || null,
            email: schoolInfo.email?.trim().toLowerCase() || null,
            schoolType: schoolInfo.schoolType,
            currentYear: parseInt(schoolInfo.currentYear, 10),
            setupComplete: true,
          },
        })
      }

      // Create admin user
      await tx.user.create({
        data: {
          name: adminInfo.name.trim(),
          email: adminInfo.email.trim().toLowerCase(),
          passwordHash,
          role: 'admin',
          active: true,
        },
      })
    })

    return { success: true }
  } catch (err) {
    if (err instanceof SetupError) return { success: false, error: err.message }
    console.error('Setup error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

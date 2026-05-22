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

    // Check if setup already done
    const existing = await db.schoolSettings.findFirst()
    if (existing?.setupComplete) {
      return { success: false, error: 'Setup has already been completed.' }
    }

    // Check for duplicate admin email
    const existingUser = await db.user.findUnique({
      where: { email: adminInfo.email.trim().toLowerCase() },
    })
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists.' }
    }

    const passwordHash = await hashPassword(adminInfo.password)

    // Run in a transaction
    await db.$transaction(async (tx: TransactionClient) => {
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
    console.error('Setup error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

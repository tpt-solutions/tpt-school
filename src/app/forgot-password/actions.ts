'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export async function requestPasswordResetAction(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const normalised = email.trim().toLowerCase()
  if (!normalised) return { success: false, error: 'Email is required.' }

  // Always return success to avoid user enumeration
  const user = await db.user.findUnique({ where: { email: normalised } })
  if (!user || !user.active) return { success: true }

  // Delete any existing token for this email
  await db.verificationToken.deleteMany({ where: { identifier: normalised } })

  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.verificationToken.create({
    data: { identifier: normalised, token, expires },
  })

  const settings = await db.schoolSettings.findFirst()
  const schoolName = settings?.name ?? 'TPT School'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  await sendEmail({
    to: normalised,
    subject: `Reset your ${schoolName} password`,
    html: `
      <p>Hi ${user.name},</p>
      <p>You requested a password reset for your ${schoolName} account.</p>
      <p><a href="${resetUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  })

  return { success: true }
}

export async function resetPasswordAction(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: 'Invalid reset link.' }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' }
  }

  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record) return { success: false, error: 'Invalid or already-used reset link.' }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } })
    return { success: false, error: 'This reset link has expired. Please request a new one.' }
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } })
  if (!user || !user.active) return { success: false, error: 'Account not found.' }

  const passwordHash = await hashPassword(newPassword)
  await db.user.update({ where: { id: user.id }, data: { passwordHash } })
  await db.verificationToken.delete({ where: { token } })

  return { success: true }
}

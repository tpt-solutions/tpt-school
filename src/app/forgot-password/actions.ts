'use server'

import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'

const TOKEN_LIFETIME_MS = 60 * 60 * 1000 // 1 hour
const REQUEST_COOLDOWN_MS = 5 * 60 * 1000 // one reset email per address every 5 minutes

/** Tokens are stored hashed: a DB read must not yield usable reset links. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function requestPasswordResetAction(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const normalised = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalised) return { success: false, error: 'Email is required.' }
  if (normalised.length > 254 || !z.email().safeParse(normalised).success) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  // Always return success to avoid user enumeration
  const user = await db.user.findUnique({ where: { email: normalised } })
  if (!user || !user.active) return { success: true }

  // Per-address cooldown. A token lives 1h, so one expiring more than
  // (1h - cooldown) from now was created within the cooldown window.
  const recent = await db.verificationToken.findFirst({
    where: { identifier: normalised, expires: { gt: new Date(Date.now() + TOKEN_LIFETIME_MS - REQUEST_COOLDOWN_MS) } },
    select: { token: true },
  })
  if (recent) return { success: true }

  // Replace any existing token for this address
  await db.verificationToken.deleteMany({ where: { identifier: normalised } })

  const token = randomBytes(32).toString('hex')
  await db.verificationToken.create({
    data: { identifier: normalised, token: hashToken(token), expires: new Date(Date.now() + TOKEN_LIFETIME_MS) },
  })

  const settings = await db.schoolSettings.findFirst()
  const schoolName = settings?.name ?? 'TPT School'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  const safeName = escapeHtml(user.name)
  const safeSchool = escapeHtml(schoolName)
  const safeUrl = escapeHtml(resetUrl)

  await sendEmail({
    to: normalised,
    subject: `Reset your ${schoolName} password`,
    html: `
      <p>Hi ${safeName},</p>
      <p>You requested a password reset for your ${safeSchool} account.</p>
      <p><a href="${safeUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    // Never persist the reset link itself in EmailLog
    logBody: '[password reset email — body redacted]',
  })

  return { success: true }
}

export async function resetPasswordAction(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return { success: false, error: 'Invalid reset link.' }
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' }
  }
  // bcrypt ignores everything past 72 bytes, so a longer password would silently be truncated
  if (Buffer.byteLength(newPassword, 'utf8') > 72) {
    return { success: false, error: 'Password must be 72 bytes or fewer.' }
  }

  const tokenHash = hashToken(token)
  const record = await db.verificationToken.findUnique({ where: { token: tokenHash } })
  if (!record) return { success: false, error: 'Invalid or already-used reset link.' }

  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { token: tokenHash } })
    return { success: false, error: 'This reset link has expired. Please request a new one.' }
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } })
  if (!user || !user.active) return { success: false, error: 'Account not found.' }

  // Claim the token atomically so two concurrent submissions cannot both succeed
  const claimed = await db.verificationToken.deleteMany({ where: { token: tokenHash } })
  if (claimed.count === 0) return { success: false, error: 'Invalid or already-used reset link.' }

  const passwordHash = await hashPassword(newPassword)
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Revoke every active session: a reset must sign out anyone holding the old credentials
    db.session.deleteMany({ where: { userId: user.id } }),
  ])

  return { success: true }
}

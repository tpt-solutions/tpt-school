'use server'

import { signIn } from '@/lib/auth'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/rate-limit'
import { headers } from 'next/headers'

export async function loginAction(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' }
  }
  // Bound input before it reaches hashing or the database (bcrypt only reads the first 72 bytes anyway)
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) {
    return { success: false, error: 'Email or password is too long.' }
  }

  // Client IP headers are client-controlled unless a reverse proxy sets them.
  // Only honour them when the operator explicitly says a proxy is in front.
  const headersList = await headers()
  const ip = process.env.TRUST_PROXY === 'true'
    ? headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || null
    : null

  const normalizedEmail = email.trim().toLowerCase()

  const rateCheck = await checkLoginRateLimit(normalizedEmail, ip)
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.error }
  }

  const result = await signIn(normalizedEmail, password)
  await recordLoginAttempt(normalizedEmail, ip, result.success)
  return result
}

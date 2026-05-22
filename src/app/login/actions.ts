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

  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  const normalizedEmail = email.trim().toLowerCase()

  const rateCheck = await checkLoginRateLimit(normalizedEmail, ip)
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.error }
  }

  const result = await signIn(normalizedEmail, password)
  await recordLoginAttempt(normalizedEmail, ip, result.success)
  return result
}

import { db } from '@/lib/db'

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS = 10

export async function checkLoginRateLimit(
  email: string,
  ip: string,
): Promise<{ allowed: boolean; error?: string }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({
      where: { email: email.toLowerCase(), success: false, createdAt: { gte: since } },
    }),
    db.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    }),
  ])

  if (byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      error: `Too many failed login attempts. Please try again in ${WINDOW_MINUTES} minutes.`,
    }
  }
  return { allowed: true }
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  try {
    await db.loginAttempt.create({
      data: { email: email.toLowerCase(), ip, success },
    })

    // Prune old attempts (keep DB lean — delete anything older than 1 hour)
    if (Math.random() < 0.1) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000)
      await db.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
    }
  } catch {
    // Never crash the login flow over logging
  }
}

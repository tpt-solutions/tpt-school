import { db } from '@/lib/db'

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS = 10

/**
 * `ip` is null when the client address cannot be trusted (no reverse proxy
 * configured). In that case only the per-email limit applies; bucketing every
 * untrusted request under one shared IP would let one attacker lock out everyone.
 */
export async function checkLoginRateLimit(
  email: string,
  ip: string | null,
): Promise<{ allowed: boolean; error?: string }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({
      where: { email: email.toLowerCase(), success: false, createdAt: { gte: since } },
    }),
    ip
      ? db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ])

  if (byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      error: `Too many failed login attempts. Please try again in ${WINDOW_MINUTES} minutes.`,
    }
  }
  return { allowed: true }
}

export async function recordLoginAttempt(email: string, ip: string | null, success: boolean) {
  try {
    await db.loginAttempt.create({
      data: { email: email.toLowerCase(), ip: ip ?? '', success },
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

// ─── Attendance code entry ───────────────────────────────────────────────────
// Attendance codes are 6 digits, so they must be rate-limited per student.
// In-memory: fine for the single-process self-hosted deployment; counters reset on restart.

const CODE_WINDOW_MS = 10 * 60 * 1000
const CODE_MAX_FAILURES = 5
const codeFailures = new Map<string, number[]>()

function recentFailures(key: string, now: number): number[] {
  const kept = (codeFailures.get(key) ?? []).filter(t => now - t < CODE_WINDOW_MS)
  if (kept.length > 0) codeFailures.set(key, kept)
  else codeFailures.delete(key)
  return kept
}

export function isCodeEntryAllowed(key: string): boolean {
  return recentFailures(key, Date.now()).length < CODE_MAX_FAILURES
}

export function recordCodeFailure(key: string): void {
  const now = Date.now()
  const list = recentFailures(key, now)
  list.push(now)
  codeFailures.set(key, list)
}

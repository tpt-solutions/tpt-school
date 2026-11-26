import 'server-only'
import { db } from '@/lib/db'
import { sendEmail, type EmailPayload } from '@/lib/email'

/**
 * Persistent outgoing-email queue for non-urgent notices.
 *
 * Callers add mail with enqueueEmail() and return immediately. processEmailQueue() runs on the
 * in-process scheduler: it sends pending items, and a failure is retried after a growing delay
 * (2, 4, 8, 16 minutes) until MAX_ATTEMPTS, after which the item is marked failed.
 *
 * Use sendEmail() directly for anything the user is waiting on (password reset, invitations).
 */

export const EMAIL_QUEUE_MAX_ATTEMPTS = 5
const BATCH_SIZE = 25

export async function enqueueEmail(payload: EmailPayload): Promise<string> {
  const item = await db.emailQueueItem.create({
    data: {
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      logBody: payload.logBody ?? null,
    },
    select: { id: true },
  })
  return item.id
}

/** Delay before the next attempt after `attempts` failed tries: 2, 4, 8, 16 minutes. */
export function retryDelayMs(attempts: number): number {
  return 2 ** attempts * 60 * 1000
}

export type QueueRunResult = { sent: number; retried: number; failed: number }

/** Sends one batch of due items. Safe to call repeatedly; each item is claimed before sending. */
export async function processEmailQueue(now = new Date()): Promise<QueueRunResult> {
  const result: QueueRunResult = { sent: 0, retried: 0, failed: 0 }

  const due = await db.emailQueueItem.findMany({
    where: { status: 'pending', runAfter: { lte: now } },
    orderBy: { runAfter: 'asc' },
    take: BATCH_SIZE,
  })

  for (const item of due) {
    // Claim the row so an overlapping run cannot send it twice.
    const claimed = await db.emailQueueItem.updateMany({
      where: { id: item.id, status: 'pending', attempts: item.attempts },
      data: { attempts: { increment: 1 } },
    })
    if (claimed.count === 0) continue

    const attempts = item.attempts + 1
    let outcome: { success: boolean; error?: string }
    try {
      outcome = await sendEmail({
        to: item.to,
        subject: item.subject,
        html: item.html,
        logBody: item.logBody ?? undefined,
      })
    } catch (err) {
      outcome = { success: false, error: err instanceof Error ? err.message : 'Send failed' }
    }

    if (outcome.success) {
      await db.emailQueueItem.update({
        where: { id: item.id },
        data: { status: 'sent', sentAt: new Date(), lastError: null },
      })
      result.sent++
    } else if (attempts >= EMAIL_QUEUE_MAX_ATTEMPTS) {
      await db.emailQueueItem.update({
        where: { id: item.id },
        data: { status: 'failed', lastError: outcome.error ?? 'Send failed' },
      })
      result.failed++
    } else {
      await db.emailQueueItem.update({
        where: { id: item.id },
        data: {
          lastError: outcome.error ?? 'Send failed',
          runAfter: new Date(Date.now() + retryDelayMs(attempts)),
        },
      })
      result.retried++
    }
  }

  return result
}

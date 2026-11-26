import 'server-only'
import { db } from '@/lib/db'
import { absenceEmailHtml } from '@/lib/email'
import { enqueueEmail } from '@/lib/email-queue'

/**
 * Emails each guardian with an email address when their child is marked absent.
 *
 * - Does nothing unless the school has turned absence emails on (off by default).
 * - Queues at most one notice per guardian, student and date. Re-saving a roll does not resend.
 *   The scheduler sends queued notices and retries failures (see lib/email-queue.ts).
 * - Never throws: a failed email is logged and must not stop the attendance save.
 */
export async function notifyGuardiansOfAbsences(studentIds: string[], date: Date): Promise<{ queued: number; skipped: number }> {
  const result = { queued: 0, skipped: 0 }
  if (studentIds.length === 0) return result

  const settings = await db.schoolSettings.findFirst({ select: { name: true, absenceEmailsEnabled: true } })
  if (!settings?.absenceEmailsEnabled) return result

  // The roll date is local midnight, so format it in local time to show the right day.
  const dateLabel = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      user: { select: { name: true } },
      parents: {
        select: {
          parent: { select: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  })

  for (const student of students) {
    for (const link of student.parents) {
      const guardian = link.parent.user
      if (!guardian.email) {
        result.skipped++
        continue
      }
      const to = guardian.email.toLowerCase()
      const subject = `${student.user.name} was marked absent on ${dateLabel}`

      try {
        // One notice per guardian, student and date: skip if already queued or sent.
        const already = await db.emailQueueItem.findFirst({
          where: { to, subject, status: { in: ['pending', 'sent'] } },
          select: { id: true },
        })
        if (already) {
          result.skipped++
          continue
        }

        await enqueueEmail({
          to,
          subject,
          html: absenceEmailHtml(guardian.name, student.user.name, dateLabel, settings.name),
          logBody: `Absence notice for ${student.user.name} on ${dateLabel}`,
        })
        result.queued++
      } catch (err) {
        console.error('Absence notice failed:', err)
        result.skipped++
      }
    }
  }

  return result
}

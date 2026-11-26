// Runs once when the Node.js server starts (see Next.js instrumentation docs).
// Starts in-process daily jobs so self-hosted installs need no external cron:
//   - fee reminders (set DISABLE_SCHEDULER=true to turn off, e.g. if you call
//     /api/cron/fee-reminders from an external scheduler instead)
//   - SQLite backups to BACKUP_DIR (set DISABLE_BACKUPS=true to turn off)
const DAY_MS = 24 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 60 * 1000
const FIRST_BACKUP_DELAY_MS = 5 * 60 * 1000
const EMAIL_QUEUE_INTERVAL_MS = 5 * 60 * 1000

declare global {
  var __feeReminderSchedulerStarted: boolean | undefined
  var __backupSchedulerStarted: boolean | undefined
  var __emailQueueStarted: boolean | undefined
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  if (process.env.DISABLE_SCHEDULER !== 'true' && !globalThis.__feeReminderSchedulerStarted) {
    // Guard against double-start in dev / hot reload
    globalThis.__feeReminderSchedulerStarted = true
    const { sendFeeReminders } = await import('@/lib/fee-reminders')

    const run = async () => {
      try {
        const result = await sendFeeReminders()
        console.log('[scheduler] fee reminders:', result)
      } catch (err) {
        console.error('[scheduler] fee reminders failed:', err)
      }
    }

    // First run shortly after boot, then every 24h. unref() so the timer never keeps the process alive.
    setTimeout(run, FIRST_RUN_DELAY_MS).unref()
    setInterval(run, DAY_MS).unref()
  }

  // Outgoing-email queue (absence notices and other non-urgent mail). Not tied to DISABLE_SCHEDULER,
  // so queued mail still goes out if fee reminders are handled elsewhere.
  if (!globalThis.__emailQueueStarted) {
    globalThis.__emailQueueStarted = true
    const { processEmailQueue } = await import('@/lib/email-queue')

    const drain = async () => {
      try {
        const result = await processEmailQueue()
        if (result.sent || result.retried || result.failed) {
          console.log('[scheduler] email queue:', result)
        }
      } catch (err) {
        console.error('[scheduler] email queue failed:', err)
      }
    }

    setTimeout(drain, 30 * 1000).unref()
    setInterval(drain, EMAIL_QUEUE_INTERVAL_MS).unref()
  }

  if (process.env.DISABLE_BACKUPS !== 'true' && !globalThis.__backupSchedulerStarted) {
    globalThis.__backupSchedulerStarted = true
    const { runBackup } = await import('@/lib/backup')

    const backup = async () => {
      try {
        const result = await runBackup()
        console.log(`[scheduler] backup written: ${result.file} (pruned ${result.pruned} old)`)
      } catch (err) {
        console.error('[scheduler] backup failed:', err)
      }
    }

    setTimeout(backup, FIRST_BACKUP_DELAY_MS).unref()
    setInterval(backup, DAY_MS).unref()
  }
}

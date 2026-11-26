// Runs once when the Node.js server starts (see Next.js instrumentation docs).
// Starts an in-process daily scheduler for fee reminders so self-hosted installs
// need no external cron. Set DISABLE_SCHEDULER=true to turn it off (e.g. if you
// call /api/cron/fee-reminders from an external scheduler instead).
const DAY_MS = 24 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 60 * 1000

declare global {
  var __feeReminderSchedulerStarted: boolean | undefined
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DISABLE_SCHEDULER === 'true') return
  // Guard against double-start in dev / hot reload
  if (globalThis.__feeReminderSchedulerStarted) return
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

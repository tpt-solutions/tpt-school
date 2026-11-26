import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendFeeReminders } from '@/lib/fee-reminders'

// Protected by CRON_SECRET — pass it as "Authorization: Bearer <secret>" from an external scheduler.
// Fails closed: if CRON_SECRET is unset, every request is rejected.
// Note: the in-process scheduler (src/instrumentation.ts) runs the same job without this route.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 401 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await sendFeeReminders())
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildIcs, isValidCalendarFeedToken } from '@/lib/ical'

export const dynamic = 'force-dynamic'

/**
 * Subscribable calendar feed (.ics) for the signed-in user's role.
 * Authenticated by a per-user token in the query string, since calendar apps do not send cookies.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('u') ?? ''
  const token = req.nextUrl.searchParams.get('t') ?? ''
  if (!userId || !token || !isValidCalendarFeedToken(userId, token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, active: true },
  })
  if (!user || !user.active) {
    return new NextResponse('Not found', { status: 404 })
  }

  const events = await db.schoolEvent.findMany({
    where: {
      OR: [{ targetRoles: 'all' }, { targetRoles: { contains: user.role } }],
    },
    orderBy: { startDate: 'asc' },
  })

  const settings = await db.schoolSettings.findFirst({ select: { name: true } })
  const host = req.nextUrl.host || 'tpt-school'
  const body = buildIcs(`${settings?.name ?? 'School'} calendar`, events, host)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="school-calendar.ics"',
      // The URL carries a token, so keep it out of shared caches.
      'Cache-Control': 'private, no-store',
    },
  })
}

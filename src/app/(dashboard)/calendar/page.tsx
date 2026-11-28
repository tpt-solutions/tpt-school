import { headers } from 'next/headers'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarFeedPath } from '@/lib/ical'
import CalendarView from './calendar-view'

export default async function CalendarPage() {
  const session = await requireSession()

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const feedUrl = `${proto}://${host}${calendarFeedPath(session.id)}`

  // Filter events visible to this user's role
  const events = await db.schoolEvent.findMany({
    where: {
      OR: [
        { targetRoles: 'all' },
        { targetRoles: { contains: session.role } },
      ],
    },
    include: {
      createdBy: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">School Calendar</h1>
        <p className="text-sm text-slate-500 mt-0.5">School events, term dates, and important notices.</p>
      </div>
      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Subscribe in your calendar app</summary>
        <p className="mt-2 text-slate-500">
          Paste this link into Google Calendar, Outlook or Apple Calendar as a new subscription.
          Treat it like a password: anyone with the link can see the events shown to your role.
        </p>
        <input
          readOnly
          value={feedUrl}
          aria-label="Calendar feed URL"
          className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
        />
      </details>
      <CalendarView
        events={events.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          allDay: e.allDay,
          category: e.category,
          createdBy: e.createdBy.name,
        }))}
        canEdit={session.role === 'admin'}
      />
    </div>
  )
}

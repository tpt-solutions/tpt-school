import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import CalendarView from './calendar-view'

export default async function CalendarPage() {
  const session = await requireSession()

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

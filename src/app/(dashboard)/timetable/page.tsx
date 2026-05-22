import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import TimetableGrid from './timetable-grid'
import { Calendar } from 'lucide-react'

export default async function TimetablePage() {
  const user = await requireRole(['admin', 'teacher'])
  const isAdmin = user.role === 'admin'

  // For teachers, find their staff record
  let staffRecord: { id: string } | null = null
  if (!isAdmin) {
    staffRecord = await db.staff.findUnique({ where: { userId: user.id } })
  }

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })

  // Load timetable slots
  const slots = await db.timetableSlot.findMany({
    where: isAdmin
      ? { class: { academicYearId: activeYear?.id } }
      : { staffId: staffRecord?.id },
    include: {
      class: true,
      room: true,
      staff: { include: { user: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
  })

  // For the editor dialog (admin only)
  const [classes, rooms, staff] = isAdmin
    ? await Promise.all([
        db.class.findMany({
          where: { academicYearId: activeYear?.id },
          orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
        }),
        db.room.findMany({ orderBy: { name: 'asc' } }),
        db.staff.findMany({ include: { user: true }, orderBy: { user: { name: 'asc' } } }),
      ])
    : [[], [], []]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timetable</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? 'Weekly schedule for all classes' : 'Your weekly class schedule'}
            {activeYear ? ` — ${activeYear.year}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar className="w-5 h-5" />
          <span className="text-sm">
            {isAdmin ? 'Click a cell to add or edit a slot' : 'Read-only view'}
          </span>
        </div>
      </div>

      {!activeYear && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          No active academic year found. Please set an active academic year first.
        </div>
      )}

      <TimetableGrid
        slots={slots}
        classes={classes}
        rooms={rooms}
        staff={staff}
        isAdmin={isAdmin}
      />
    </div>
  )
}

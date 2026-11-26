import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import {
  generateInterviewSlotsAction,
  bookInterviewSlotAction,
  releaseInterviewSlotAction,
  deleteInterviewSlotAction,
} from './actions'

const TIME_FMT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

export default async function InterviewsPage() {
  await requireRole(['admin'])

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [slots, staff, students] = await Promise.all([
    db.interviewSlot.findMany({
      where: { startsAt: { gte: startOfToday } },
      include: {
        staff: { include: { user: { select: { name: true } } } },
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 1000,
    }),
    db.staff.findMany({
      where: { dateLeft: null },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 2000,
    }),
  ])

  // Group by teacher, then by day
  const byTeacher = new Map<string, { name: string; days: Map<string, typeof slots> }>()
  for (const slot of slots) {
    const key = slot.staffId
    if (!byTeacher.has(key)) byTeacher.set(key, { name: slot.staff.user.name, days: new Map() })
    const dayKey = slot.startsAt.toLocaleDateString('en-CA')
    const days = byTeacher.get(key)!.days
    if (!days.has(dayKey)) days.set(dayKey, [])
    days.get(dayKey)!.push(slot)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parent-teacher interviews</h1>
        <p className="text-sm text-slate-500 mt-1">Generate slots for a teacher, then book a family into each one.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Generate slots</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={generateInterviewSlotsAction} submitLabel="Generate slots">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Teacher *" htmlFor="staffId">
                <select id="staffId" name="staffId" required defaultValue="" className={controlClass}>
                  <option value="" disabled>Select teacher…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
                </select>
              </Field>
              <Field label="Date *" htmlFor="date"><input id="date" name="date" type="date" required className={controlClass} /></Field>
              <Field label="First slot starts *" htmlFor="startTime"><input id="startTime" name="startTime" type="time" required defaultValue="15:00" className={controlClass} /></Field>
              <Field label="Slot length (minutes) *" htmlFor="slotMinutes"><input id="slotMinutes" name="slotMinutes" type="number" min={5} max={60} required defaultValue={10} className={controlClass} /></Field>
              <Field label="Number of slots *" htmlFor="count"><input id="count" name="count" type="number" min={1} max={60} required defaultValue={10} className={controlClass} /></Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {byTeacher.size === 0 && <p className="text-sm text-slate-500">No upcoming interview slots.</p>}

      {[...byTeacher.entries()].map(([staffId, group]) => (
        <Card key={staffId}>
          <CardHeader><CardTitle className="text-base">{group.name}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {[...group.days.entries()].map(([day, daySlots]) => (
              <div key={day} className="space-y-2">
                <h3 className="text-sm font-medium text-slate-700">
                  {daySlots[0].startsAt.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <ul className="divide-y rounded-lg border">
                  {daySlots.map((slot) => (
                    <li key={slot.id} className="flex flex-wrap items-center gap-3 p-3">
                      <span className="w-28 whitespace-nowrap font-mono text-sm text-slate-600">
                        {slot.startsAt.toLocaleTimeString('en-NZ', TIME_FMT)}–{slot.endsAt.toLocaleTimeString('en-NZ', TIME_FMT)}
                      </span>
                      {slot.student ? (
                        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Booked</Badge>
                            <span>{slot.student.user.name}</span>
                            {slot.notes && <span className="text-sm text-slate-500">· {slot.notes}</span>}
                          </div>
                          <ActionForm action={releaseInterviewSlotAction} submitLabel="Release" variant="outline" hidden={{ id: slot.id }} resetOnSuccess={false} confirmMessage="Release this booking?">
                            {null}
                          </ActionForm>
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-wrap items-end gap-2">
                          <div className="min-w-56 flex-1">
                            <ActionForm action={bookInterviewSlotAction} submitLabel="Book" hidden={{ slotId: slot.id }}>
                              <select name="studentId" required defaultValue="" aria-label="Student to book" className={controlClass}>
                                <option value="" disabled>Book a student…</option>
                                {students.map((s) => <option key={s.id} value={s.id}>{s.user.name} ({s.studentId})</option>)}
                              </select>
                            </ActionForm>
                          </div>
                          <ActionForm action={deleteInterviewSlotAction} submitLabel="Delete slot" variant="ghost" hidden={{ id: slot.id }} resetOnSuccess={false} confirmMessage="Delete this slot?">
                            {null}
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

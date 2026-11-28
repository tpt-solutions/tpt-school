import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { linkedStudentsFor } from '@/lib/portal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { bookOwnInterviewAction, cancelOwnInterviewAction } from './actions'

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

export default async function PortalInterviewsPage() {
  const user = await requireRole(['parent'])
  const children = await linkedStudentsFor(user)
  const childIds = children.map((c) => c.id)
  const now = new Date()

  const [open, booked] = await Promise.all([
    db.interviewSlot.findMany({
      where: { studentId: null, startsAt: { gt: now } },
      include: { staff: { include: { user: { select: { name: true } } } } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 300,
    }),
    childIds.length
      ? db.interviewSlot.findMany({
          where: { studentId: { in: childIds }, startsAt: { gt: now } },
          include: {
            staff: { include: { user: { select: { name: true } } } },
            student: { include: { user: { select: { name: true } } } },
          },
          orderBy: { startsAt: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const dayLabel = (d: Date) => d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parent-teacher interviews</h1>
        <p className="text-sm text-slate-500 mt-1">Choose a time for one of your children. Times are first come, first served.</p>
      </div>

      {children.length === 0 ? (
        <p className="text-sm text-slate-500">No children are linked to your account yet.</p>
      ) : (
        <>
          <Card className="border-slate-100">
            <CardHeader><CardTitle className="text-base">Your bookings</CardTitle></CardHeader>
            <CardContent>
              {booked.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming interviews booked.</p>
              ) : (
                <ul className="divide-y">
                  {booked.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <div className="font-medium text-slate-900">
                          {dayLabel(s.startsAt)} · {s.startsAt.toLocaleTimeString('en-NZ', TIME)}–{s.endsAt.toLocaleTimeString('en-NZ', TIME)}
                        </div>
                        <div className="text-slate-600">{s.student?.user.name} with {s.staff.user.name}</div>
                      </div>
                      <ActionForm action={cancelOwnInterviewAction} submitLabel="Cancel booking" variant="outline" hidden={{ slotId: s.id }} resetOnSuccess={false} confirmMessage="Cancel this interview booking?">
                        {null}
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-100">
            <CardHeader><CardTitle className="text-base">Available times</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {open.length === 0 ? (
                <p className="text-sm text-slate-500">No times are open at the moment. Check back later or contact the school office.</p>
              ) : (
                <>
                  {children.length > 1 && (
                    <p className="text-sm text-slate-600">Pick the child you are booking for on each time below.</p>
                  )}
                  {[...new Map(open.map((s) => [s.startsAt.toLocaleDateString('en-CA'), s])).keys()].map((dayKey) => {
                    const daySlots = open.filter((s) => s.startsAt.toLocaleDateString('en-CA') === dayKey)
                    return (
                      <div key={dayKey} className="space-y-2">
                        <h3 className="text-sm font-medium text-slate-700">{dayLabel(daySlots[0].startsAt)}</h3>
                        <ul className="divide-y rounded-lg border">
                          {daySlots.map((slot) => (
                            <li key={slot.id} className="flex flex-wrap items-end gap-3 p-3">
                              <div className="w-44 text-sm">
                                <div className="font-mono text-slate-700">
                                  {slot.startsAt.toLocaleTimeString('en-NZ', TIME)}–{slot.endsAt.toLocaleTimeString('en-NZ', TIME)}
                                </div>
                                <div className="text-slate-500">{slot.staff.user.name}</div>
                              </div>
                              <div className="min-w-56 flex-1">
                                <ActionForm action={bookOwnInterviewAction} submitLabel="Book this time" hidden={{ slotId: slot.id }}>
                                  <Field label="Child" htmlFor={`child-${slot.id}`}>
                                    <select id={`child-${slot.id}`} name="studentId" required defaultValue={children.length === 1 ? children[0].id : ''} className={controlClass}>
                                      <option value="" disabled>Select child…</option>
                                      {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </Field>
                                </ActionForm>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

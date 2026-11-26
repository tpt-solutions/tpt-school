import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { createCoverAction, assignCoverAction, cancelCoverAction } from './actions'

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  open: { label: 'Needs cover', variant: 'destructive' },
  covered: { label: 'Covered', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

export default async function SubstitutesPage() {
  await requireRole(['admin'])

  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - 7)

  const [covers, staff, classes] = await Promise.all([
    db.substituteCover.findMany({
      where: { date: { gte: since } },
      include: {
        absentStaff: { include: { user: { select: { name: true } } } },
        coverStaff: { include: { user: { select: { name: true } } } },
        class: { select: { name: true, code: true } },
      },
      orderBy: [{ date: 'asc' }, { periodLabel: 'asc' }, { id: 'asc' }],
      take: 200,
    }),
    db.staff.findMany({
      where: { dateLeft: null },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.class.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: 'asc' }, take: 300 }),
  ])

  const staffName = (s: { user: { name: string } }) => s.user.name

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Substitute cover</h1>
        <p className="text-sm text-slate-500 mt-1">Log teacher absences and assign a covering teacher for each affected period.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Record an absence</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createCoverAction} submitLabel="Add cover request">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Absent teacher *" htmlFor="absentStaffId">
                <select id="absentStaffId" name="absentStaffId" required className={controlClass} defaultValue="">
                  <option value="" disabled>Select teacher…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
                </select>
              </Field>
              <Field label="Date *" htmlFor="date">
                <input id="date" name="date" type="date" required className={controlClass} />
              </Field>
              <Field label="Period" htmlFor="periodLabel">
                <input id="periodLabel" name="periodLabel" maxLength={50} placeholder="e.g. Period 3" className={controlClass} />
              </Field>
              <Field label="Class" htmlFor="classId">
                <select id="classId" name="classId" className={controlClass} defaultValue="">
                  <option value="">None</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes" htmlFor="notes">
                  <input id="notes" name="notes" maxLength={500} className={controlClass} />
                </Field>
              </div>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cover requests (last 7 days onward)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {covers.length === 0 && <p className="text-sm text-slate-500">No cover requests.</p>}
          {covers.map((c) => {
            const info = STATUS[c.status] ?? { label: c.status, variant: 'outline' as const }
            const options = staff.filter((s) => s.id !== c.absentStaffId)
            return (
              <div key={c.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {c.date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {c.periodLabel ? ` · ${c.periodLabel}` : ''}
                    </div>
                    <div className="text-sm text-slate-600">
                      {staffName(c.absentStaff)} absent{c.class ? ` · ${c.class.code} ${c.class.name}` : ''}
                    </div>
                    {c.coverStaff && <div className="text-sm text-slate-600">Covered by {staffName(c.coverStaff)}</div>}
                    {c.notes && <div className="text-xs text-slate-500">{c.notes}</div>}
                  </div>
                  <Badge variant={info.variant}>{info.label}</Badge>
                </div>
                {c.status === 'open' && (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
                    <ActionForm action={assignCoverAction} submitLabel="Assign cover" hidden={{ id: c.id }}>
                      <Field label="Covering teacher" htmlFor={`cover-${c.id}`}>
                        <select id={`cover-${c.id}`} name="coverStaffId" required className={controlClass} defaultValue="">
                          <option value="" disabled>Select teacher…</option>
                          {options.map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
                        </select>
                      </Field>
                    </ActionForm>
                    <ActionForm action={cancelCoverAction} submitLabel="Cancel request" variant="outline" hidden={{ id: c.id }} resetOnSuccess={false} confirmMessage="Cancel this cover request?">
                      {null}
                    </ActionForm>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

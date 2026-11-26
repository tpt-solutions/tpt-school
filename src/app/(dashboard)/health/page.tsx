import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { logHealthVisitAction } from './actions'

export default async function HealthPage() {
  await requireRole(['admin'])

  const [visits, students] = await Promise.all([
    db.healthVisit.findMany({
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { visitedAt: 'desc' },
      take: 100,
    }),
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 2000,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Health room</h1>
        <p className="text-sm text-slate-500 mt-1">
          Record visits to the health room. Visible to administrators only; every entry is logged.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Log a visit</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={logHealthVisitAction} submitLabel="Log visit">
            <Field label="Student *" htmlFor="studentId">
              <select id="studentId" name="studentId" required defaultValue="" className={controlClass}>
                <option value="" disabled>Select student…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.user.name} ({s.studentId})</option>)}
              </select>
            </Field>
            <Field label="Reason *" htmlFor="reason">
              <input id="reason" name="reason" required maxLength={500} className={controlClass} />
            </Field>
            <Field label="Treatment given" htmlFor="treatment">
              <input id="treatment" name="treatment" maxLength={1000} className={controlClass} />
            </Field>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="sentHome" /> Sent home</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="parentNotified" /> Parent notified</label>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent visits</CardTitle></CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-sm text-slate-500">No visits recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-stack">
                <caption className="sr-only">Recent health room visits</caption>
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th scope="col" className="py-2 pr-4 font-medium">When</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Reason</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Treatment</th>
                    <th scope="col" className="py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-b last:border-0 align-top">
                      <td data-label="When" className="py-2 pr-4 whitespace-nowrap text-slate-600">{v.visitedAt.toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td data-label="Student" className="py-2 pr-4"><Link href={`/students/${v.studentId}`} className="hover:underline">{v.student.user.name}</Link></td>
                      <td data-label="Reason" className="py-2 pr-4">{v.reason}</td>
                      <td data-label="Treatment" className="py-2 pr-4 text-slate-600">{v.treatment ?? '—'}</td>
                      <td data-label="Outcome" className="py-2 text-slate-600">
                        {[v.sentHome && 'Sent home', v.parentNotified && 'Parent notified'].filter(Boolean).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

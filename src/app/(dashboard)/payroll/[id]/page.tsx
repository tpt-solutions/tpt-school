import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { addPayLineAction, removePayLineAction, markPayRunPaidAction } from '../actions'

export default async function PayRunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params

  const run = await db.payRun.findUnique({
    where: { id },
    include: {
      lines: {
        include: { staff: { include: { user: { select: { name: true } } } } },
        orderBy: { staff: { user: { name: 'asc' } } },
      },
    },
  })
  if (!run) notFound()

  const isDraft = run.status === 'draft'
  const staffOnRun = new Set(run.lines.map((l) => l.staffId))
  const staff = await db.staff.findMany({
    where: { dateLeft: null },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  })
  const available = staff.filter((s) => !staffOnRun.has(s.id))
  const gross = run.lines.reduce((sum, l) => sum + l.grossCents, 0)
  const net = run.lines.reduce((sum, l) => sum + l.netCents, 0)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="mb-2 inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="mr-1 h-4 w-4" /> All pay runs
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{run.label}</h1>
          <Badge variant={isDraft ? 'outline' : 'default'}>{isDraft ? 'Draft' : 'Paid'}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Period {run.periodStart.toLocaleDateString('en-NZ')} to {run.periodEnd.toLocaleDateString('en-NZ')} · Pay date{' '}
          {run.payDate.toLocaleDateString('en-NZ')}
          {run.paidAt ? ` · Marked paid ${run.paidAt.toLocaleDateString('en-NZ')}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {run.lines.length === 0 ? (
            <p className="text-sm text-slate-500">No lines yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-stack">
                <caption className="sr-only">Pay lines for {run.label}</caption>
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th scope="col" className="py-2 pr-4 font-medium">Staff member</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Gross</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Net</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Notes</th>
                    <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {run.lines.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td data-label="Staff member" className="py-2 pr-4">{l.staff.user.name}</td>
                      <td data-label="Gross" className="py-2 pr-4 text-right">{formatCents(l.grossCents)}</td>
                      <td data-label="Net" className="py-2 pr-4 text-right">{formatCents(l.netCents)}</td>
                      <td data-label="Notes" className="py-2 pr-4 text-slate-600">{l.notes ?? '—'}</td>
                      <td data-label="Actions" className="py-2 text-right">
                        {isDraft && (
                          <ActionForm action={removePayLineAction} submitLabel="Remove" variant="ghost" hidden={{ id: l.id }} resetOnSuccess={false} confirmMessage="Remove this line?">
                            {null}
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td data-label="Total" className="py-2 pr-4">Total</td>
                    <td data-label="Gross" className="py-2 pr-4 text-right">{formatCents(gross)}</td>
                    <td data-label="Net" className="py-2 pr-4 text-right">{formatCents(net)}</td>
                    <td data-label="Notes" />
                    <td data-label="Actions" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {isDraft && (
            <div className="space-y-6 border-t pt-4">
              {available.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-700">Add a line</h3>
                  <ActionForm action={addPayLineAction} submitLabel="Add line" hidden={{ payRunId: run.id }}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Staff member *" htmlFor="staffId">
                        <select id="staffId" name="staffId" required defaultValue="" className={controlClass}>
                          <option value="" disabled>Select…</option>
                          {available.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Gross amount *" htmlFor="grossAmount"><input id="grossAmount" name="grossAmount" required inputMode="decimal" placeholder="0.00" className={controlClass} /></Field>
                      <Field label="Net amount *" htmlFor="netAmount"><input id="netAmount" name="netAmount" required inputMode="decimal" placeholder="0.00" className={controlClass} /></Field>
                    </div>
                    <Field label="Notes" htmlFor="notes"><input id="notes" name="notes" maxLength={300} className={controlClass} /></Field>
                  </ActionForm>
                </div>
              )}

              {run.lines.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-slate-600">
                    Marking the run paid locks every line. Check the amounts against your payroll provider first.
                  </p>
                  <ActionForm action={markPayRunPaidAction} submitLabel="Mark run as paid" variant="outline" hidden={{ id: run.id }} resetOnSuccess={false} confirmMessage="Mark this run as paid? Its lines can no longer be changed.">
                    {null}
                  </ActionForm>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

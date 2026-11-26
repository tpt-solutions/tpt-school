import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { createPayRunAction } from './actions'

export default async function PayrollPage() {
  await requireRole(['admin'])

  const runs = await db.payRun.findMany({
    include: { lines: { select: { grossCents: true, netCents: true } } },
    orderBy: { payDate: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pay records</h1>
        <p className="text-sm text-slate-500 mt-1">
          Record what was paid in each pay run. Amounts are entered by hand; the app does not calculate tax or deductions.
          Visible to administrators only.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">New pay run</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createPayRunAction} submitLabel="Create pay run">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Label *" htmlFor="label"><input id="label" name="label" required maxLength={80} placeholder="e.g. Fortnight 3 — Nov" className={controlClass} /></Field>
              <Field label="Pay date *" htmlFor="payDate"><input id="payDate" name="payDate" type="date" required className={controlClass} /></Field>
              <Field label="Period start *" htmlFor="periodStart"><input id="periodStart" name="periodStart" type="date" required className={controlClass} /></Field>
              <Field label="Period end *" htmlFor="periodEnd"><input id="periodEnd" name="periodEnd" type="date" required className={controlClass} /></Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pay runs</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">No pay runs yet.</p>
          ) : (
            <ul className="divide-y">
              {runs.map((run) => {
                const gross = run.lines.reduce((sum, l) => sum + l.grossCents, 0)
                const net = run.lines.reduce((sum, l) => sum + l.netCents, 0)
                return (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <Link href={`/payroll/${run.id}`} className="font-medium text-slate-900 hover:underline">{run.label}</Link>
                      <div className="text-sm text-slate-600">
                        Pay date {run.payDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })} · {run.lines.length} line{run.lines.length === 1 ? '' : 's'} · gross {formatCents(gross)} · net {formatCents(net)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={run.status === 'paid' ? 'default' : 'outline'}>{run.status === 'paid' ? 'Paid' : 'Draft'}</Badge>
                      <Link href={`/payroll/${run.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Open</Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

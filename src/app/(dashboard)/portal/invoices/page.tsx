import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { linkedStudentsFor } from '@/lib/portal'
import { formatCents } from '@/lib/money'
import { format } from 'date-fns'
import { paymentsEnabled } from '@/lib/payments'
import { PayInvoiceButton } from './pay-invoice-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Finance is shown to parents only. Students use the school office for fee questions.
export default async function PortalInvoicesPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const user = await requireRole(['parent'])
  const children = await linkedStudentsFor(user)
  const { payment } = await searchParams
  const online = paymentsEnabled()

  const invoices = await db.feeInvoice.findMany({
    where: { studentId: { in: children.map(c => c.id) } },
    include: { student: { include: { user: { select: { name: true } } } }, items: true },
    orderBy: [{ dueDate: 'desc' }],
  })

  const outstanding = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.totalAmountCents - inv.paidAmountCents), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-sm text-slate-500">Fees and payments for your children.</p>
      </div>

      {payment === 'success' && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Thank you. Your payment is being confirmed and will appear here shortly.
        </p>
      )}
      {payment === 'cancelled' && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          Payment cancelled. Nothing has been charged.
        </p>
      )}

      <Card className="border-slate-100">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-600">Total outstanding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-slate-900">{formatCents(outstanding)}</div>
        </CardContent>
      </Card>

      <Card className="border-slate-100">
        <CardContent className="pt-6">
          {invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-stack">
                <caption className="sr-only">My invoices</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    {online && <TableHead><span className="sr-only">Pay</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell data-label="Student">{inv.student.user.name}</TableCell>
                      <TableCell data-label="Items">{inv.items.map(i => i.description).join(', ') || `#${inv.id.slice(-6)}`}</TableCell>
                      <TableCell data-label="Due">{format(inv.dueDate, 'd MMM yyyy')}</TableCell>
                      <TableCell data-label="Total" className="text-right">{formatCents(inv.totalAmountCents)}</TableCell>
                      <TableCell data-label="Paid" className="text-right">{formatCents(inv.paidAmountCents)}</TableCell>
                      <TableCell data-label="Balance" className="text-right font-medium">{formatCents(inv.totalAmountCents - inv.paidAmountCents)}</TableCell>
                      <TableCell data-label="Status" className="capitalize">{inv.status}</TableCell>
                      {online && (
                        <TableCell data-label="Pay" className="text-right">
                          {inv.totalAmountCents - inv.paidAmountCents > 0 && <PayInvoiceButton invoiceId={inv.id} />}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

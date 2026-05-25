import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import FeeReminderButton from './fee-reminder-button'

const STATUS_STYLES: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  waived: 'bg-slate-100 text-slate-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${amount.toFixed(2)}`
}

export default async function FinancePage() {
  await requireRole(['admin'])

  const settings = await db.schoolSettings.findFirst()
  const currencySymbol = settings?.currencySymbol ?? '$'

  // Overview stats
  const [unpaidInvoices, overdueInvoices, allInvoices] = await Promise.all([
    db.feeInvoice.findMany({ where: { status: { in: ['unpaid', 'partial'] } }, select: { totalAmount: true, paidAmount: true } }),
    db.feeInvoice.count({ where: { status: 'overdue' } }),
    db.feeInvoice.findMany({
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const totalOutstanding = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount ?? 0)),
    0,
  )

  // Paid this term (approximate: current month for simplicity)
  const termStart = new Date()
  termStart.setDate(1)
  const paidThisTerm = await db.feePayment.aggregate({
    where: { paidAt: { gte: termStart } },
    _sum: { amount: true },
  })

  const feeTypes = await db.feeType.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Invoices, payments, and fee management</p>
        </div>
        <div className="flex items-start gap-3 flex-wrap justify-end">
          <FeeReminderButton />
          <Link href="/finance/invoices/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Outstanding</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding, currencySymbol)}</div>
            <p className="text-xs text-slate-500 mt-1">Across unpaid &amp; partial invoices</p>
          </CardContent>
        </Card>

        <Card className="border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Paid This Month</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(paidThisTerm._sum.amount ?? 0, currencySymbol)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total payments received</p>
          </CardContent>
        </Card>

        <Card className="border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Overdue Invoices</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{overdueInvoices}</div>
            <p className="text-xs text-slate-500 mt-1">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="fee-types">Fee Types</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          {allInvoices.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No invoices yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Issue Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Due Date</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Paid</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {inv.student.user.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {format(new Date(inv.issueDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatCurrency(inv.totalAmount, currencySymbol)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(inv.paidAmount ?? 0, currencySymbol)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/finance/invoices/${inv.id}`}
                          className="text-primary text-xs font-medium hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Fee Types Tab */}
        <TabsContent value="fee-types" className="mt-4">
          <div className="flex justify-end mb-3">
            <Link href="/finance/fee-types">
              <Button variant="outline" size="sm">
                Manage Fee Types
              </Button>
            </Link>
          </div>
          {feeTypes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No fee types defined yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Frequency</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Year Level</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {feeTypes.map(ft => (
                    <tr key={ft.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{ft.name}</td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatCurrency(ft.amount, currencySymbol)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{ft.frequency}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {ft.yearLevel != null ? `Year ${ft.yearLevel}` : 'All years'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ft.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {ft.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

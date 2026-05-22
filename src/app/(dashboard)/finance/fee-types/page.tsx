import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import FeeTypeForm from './fee-type-form'
import { Card, CardContent } from '@/components/ui/card'

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${amount.toFixed(2)}`
}

export default async function FeeTypesPage() {
  await requireRole(['admin'])

  const settings = await db.schoolSettings.findFirst()
  const currencySymbol = settings?.currencySymbol ?? '$'

  const feeTypes = await db.feeType.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/finance"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Finance
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Fee Types</h1>
        <p className="text-sm text-slate-500 mt-0.5">Define the types of fees charged to students.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <FeeTypeForm currencySymbol={currencySymbol} />
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          {feeTypes.length === 0 ? (
            <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No fee types defined yet.
            </div>
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
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{ft.name}</p>
                        {ft.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{ft.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
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
        </div>
      </div>
    </div>
  )
}

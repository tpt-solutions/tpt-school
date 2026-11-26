import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import RecurringFeesForm from './recurring-fees-form'

export default async function RecurringFeesPage() {
  await requireRole(['admin'])

  const [activeYear, settings] = await Promise.all([
    db.academicYear.findFirst({
      where: { active: true },
      include: { terms: { orderBy: { termNumber: 'asc' } } },
    }),
    db.schoolSettings.findFirst({ select: { currencySymbol: true } }),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/finance" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Finance
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Term fees</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {activeYear ? `Academic year ${activeYear.year}` : 'No active academic year'}
        </p>
      </div>
      <RecurringFeesForm
        terms={activeYear?.terms.map(t => ({ id: t.id, name: t.name })) ?? []}
        currencySymbol={settings?.currencySymbol ?? '$'}
      />
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import InvoiceForm from '../../invoice-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewInvoicePage() {
  await requireRole(['admin'])

  const settings = await db.schoolSettings.findFirst()
  const currencySymbol = settings?.currencySymbol ?? '$'

  const [students, feeTypes] = await Promise.all([
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.feeType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const studentOptions = students.map(s => ({
    id: s.id,
    name: s.user.name,
    studentId: s.studentId,
  }))

  const feeTypeOptions = feeTypes.map(ft => ({
    id: ft.id,
    name: ft.name,
    amount: ft.amount,
  }))

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/finance"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Finance
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New Invoice</h1>
      </div>
      <InvoiceForm
        students={studentOptions}
        feeTypes={feeTypeOptions}
        currencySymbol={currencySymbol}
      />
    </div>
  )
}

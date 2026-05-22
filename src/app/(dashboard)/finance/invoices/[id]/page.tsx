import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import InvoiceDetailClient from './invoice-detail-client'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(['admin'])
  const { id } = await params

  const settings = await db.schoolSettings.findFirst()
  const currencySymbol = settings?.currencySymbol ?? '$'

  const invoice = await db.feeInvoice.findUnique({
    where: { id },
    include: {
      student: { include: { user: { select: { name: true } } } },
      items: true,
      payments: { orderBy: { paidAt: 'desc' } },
    },
  })

  if (!invoice) notFound()

  const invoiceData = {
    id: invoice.id,
    status: invoice.status,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    dueDate: invoice.dueDate,
    issueDate: invoice.issueDate,
    notes: invoice.notes,
    studentName: invoice.student.user.name,
    studentId: invoice.student.studentId,
    items: invoice.items.map(item => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
    })),
    payments: invoice.payments.map(p => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt,
    })),
  }

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
        <h1 className="text-2xl font-bold text-slate-900">Invoice Details</h1>
      </div>
      <InvoiceDetailClient invoice={invoiceData} currencySymbol={currencySymbol} />
    </div>
  )
}

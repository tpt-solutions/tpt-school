import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StaffForm from '../../staff-form'

type Params = Promise<{ id: string }>

export default async function EditStaffPage({ params }: { params: Params }) {
  await requireRole(['admin'])
  const { id } = await params

  const staff = await db.staff.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!staff) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/staff/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Staff Profile
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Edit Staff Member</h1>
        <p className="text-sm text-slate-500 mt-1">
          Updating details for <span className="font-medium text-slate-700">{staff.user.name}</span>
        </p>
      </div>

      <StaffForm staff={staff} />
    </div>
  )
}

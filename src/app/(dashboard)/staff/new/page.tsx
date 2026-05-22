import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StaffForm from '../staff-form'

export default async function NewStaffPage() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/staff"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Staff
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add Staff Member</h1>
        <p className="text-sm text-slate-500 mt-1">
          Fill in the details below to add a new staff member. A temporary password will be set — they should change it on first login.
        </p>
      </div>

      <StaffForm />
    </div>
  )
}

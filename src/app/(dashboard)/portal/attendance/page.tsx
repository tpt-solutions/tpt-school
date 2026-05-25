import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import AttendanceCodeForm from './attendance-code-form'

export default async function PortalAttendancePage() {
  await requireRole(['student'])

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Portal
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Mark Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter the 6-digit code shown by your teacher to mark yourself present.
        </p>
      </div>

      <AttendanceCodeForm />
    </div>
  )
}

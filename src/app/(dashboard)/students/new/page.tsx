import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudentForm from '../student-form'

export default async function NewStudentPage() {
  await requireRole(['admin', 'teacher'])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Students
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Enrol New Student</h1>
        <p className="text-sm text-slate-500 mt-1">
          Fill in the details below to enrol a new student. A temporary password will be set — the student should change it on first login.
        </p>
      </div>

      <StudentForm />
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import ClassForm from '../class-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewClassPage() {
  await requireRole(['admin'])

  const [rooms, academicYears, staff] = await Promise.all([
    db.room.findMany({ orderBy: { name: 'asc' } }),
    db.academicYear.findMany({ orderBy: { year: 'desc' } }),
    db.staff.findMany({ include: { user: true }, orderBy: { user: { name: 'asc' } } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/classes"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Classes
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New Class</h1>
        <p className="text-sm text-slate-500 mt-1">Create a new class for the academic year</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <ClassForm rooms={rooms} academicYears={academicYears} staff={staff} />
      </div>
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudentForm from '../../student-form'

type Params = Promise<{ id: string }>

export default async function EditStudentPage({ params }: { params: Params }) {
  await requireRole(['admin', 'teacher'])
  const { id } = await params

  const student = await db.student.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!student) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/students/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Student
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Edit Student</h1>
        <p className="text-sm text-slate-500 mt-1">
          Updating details for <span className="font-medium text-slate-700">{student.user.name}</span>
        </p>
      </div>

      <StudentForm student={student} />
    </div>
  )
}

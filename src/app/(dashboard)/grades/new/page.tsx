import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import GradebookForm from '../gradebook-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ classId?: string }>
}

export default async function NewGradebookPage({ searchParams }: PageProps) {
  const user = await requireRole(['admin', 'teacher'])
  const { classId } = await searchParams

  // Teachers only see their own classes
  let classes
  if (user.role === 'admin') {
    classes = await db.class.findMany({
      orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
    })
  } else {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    classes = staff
      ? await db.class.findMany({
          where: { teachers: { some: { staffId: staff.id } } },
          orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
        })
      : []
  }

  const terms = await db.term.findMany({
    include: { academicYear: true },
    orderBy: [{ academicYear: { year: 'desc' } }, { termNumber: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/grades"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Gradebook
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New Assessment</h1>
        <p className="text-sm text-slate-500 mt-1">Create a new gradebook assessment</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <GradebookForm classes={classes} terms={terms} defaultClassId={classId} />
      </div>
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import GradeEntry from './grade-entry'
import { format } from 'date-fns'

const TYPE_COLORS: Record<string, string> = {
  assessment: 'bg-blue-100 text-blue-700',
  exam: 'bg-red-100 text-red-700',
  assignment: 'bg-green-100 text-green-700',
  project: 'bg-purple-100 text-purple-700',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GradebookDetailPage({ params }: PageProps) {
  await requireRole(['admin', 'teacher'])
  const { id } = await params

  const gradebook = await db.gradebook.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          enrolments: {
            where: { status: 'active' },
            include: { student: { include: { user: true } } },
            orderBy: { student: { user: { name: 'asc' } } },
          },
        },
      },
      term: { include: { academicYear: true } },
      grades: true,
    },
  })

  if (!gradebook) notFound()

  type GradeRec = { score: number | null; grade: string | null; comment: string | null }
  const gradeMap = new Map<string, GradeRec>(gradebook.grades.map((g) => [g.studentId, g as GradeRec]))

  const students = gradebook.class.enrolments.map((enrolment) => {
    const existing = gradeMap.get(enrolment.student.id)
    return {
      studentId: enrolment.student.id,
      name: enrolment.student.user.name,
      studentCode: enrolment.student.studentId,
      existingScore: existing?.score,
      existingGrade: existing?.grade,
      existingComment: existing?.comment,
    }
  })

  // Stats
  const gradedScores = gradebook.grades
    .filter((g) => g.score != null)
    .map((g) => g.score as number)
  const avg = gradedScores.length > 0
    ? Math.round((gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length) * 10) / 10
    : null
  const highest = gradedScores.length > 0 ? Math.max(...gradedScores) : null
  const lowest = gradedScores.length > 0 ? Math.min(...gradedScores) : null

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
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{gradebook.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {gradebook.class.name} &middot; {gradebook.term.name} ({gradebook.term.academicYear.year})
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={(TYPE_COLORS[gradebook.type] ?? 'bg-slate-100 text-slate-700') + ' border-0 capitalize'}>
              {gradebook.type}
            </Badge>
            {gradebook.dueDate && (
              <Badge variant="outline">Due: {format(new Date(gradebook.dueDate), 'dd MMM yyyy')}</Badge>
            )}
            <Badge variant="outline">Max: {gradebook.maxScore}</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      {gradedScores.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Graded</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {gradedScores.length} <span className="text-base font-normal text-slate-400">/ {students.length}</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Average</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{avg}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Highest</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{highest}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Lowest</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{lowest}</p>
          </div>
        </div>
      )}

      <GradeEntry
        gradebookId={gradebook.id}
        maxScore={gradebook.maxScore}
        students={students}
      />
    </div>
  )
}

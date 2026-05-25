import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import RollForm from './roll-form'
import CodePanel from './code-panel'
import { format } from 'date-fns'

interface PageProps {
  params: Promise<{ classId: string }>
}

export default async function TakeRollPage({ params }: PageProps) {
  const session = await requireRole(['admin', 'teacher'])
  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      room: true,
      enrolments: {
        where: { status: 'active' },
        include: { student: { include: { user: true } } },
        orderBy: { student: { user: { name: 'asc' } } },
      },
    },
  })

  if (!cls) notFound()

  // Get today's existing attendance records
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const existingRecords = await db.attendance.findMany({
    where: {
      studentId: { in: cls.enrolments.map((e: { studentId: string }) => e.studentId) },
      date: { gte: today, lte: todayEnd },
    },
  })

  // Fetch current term for offline queue
  const currentTerm = await db.term.findFirst({
    where: { startDate: { lte: new Date() }, endDate: { gte: new Date() } },
    orderBy: { startDate: 'desc' },
  })

  type AttRec = { studentId: string; status: string; notes: string | null }
  const existingMap = new Map<string, AttRec>(
    existingRecords.map((r) => [r.studentId, { studentId: r.studentId, status: r.status, notes: r.notes }])
  )

  const students = cls.enrolments.map((enrolment: { studentId: string; student: { id: string; studentId: string; user: { name: string } } }) => ({
    studentId: enrolment.student.id,
    name: enrolment.student.user.name,
    studentCode: enrolment.student.studentId,
    existingStatus: existingMap.get(enrolment.student.id)?.status,
    existingNotes: existingMap.get(enrolment.student.id)?.notes ?? undefined,
  }))

  const todayDisplay = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/attendance"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Attendance
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{cls.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{todayDisplay}</p>
          </div>
          <div className="flex items-center gap-2">
            {cls.yearLevel && <Badge variant="secondary">Year {cls.yearLevel}</Badge>}
            {cls.room && (
              <Badge variant="outline" className="font-mono">{cls.room.code}</Badge>
            )}
            <Badge variant="outline">{students.length} students</Badge>
            {existingRecords.length > 0 && (
              <Badge className="bg-green-100 text-green-700 border-0">Roll taken</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <RollForm classId={classId} students={students} termId={currentTerm?.id ?? ''} markedById={session.id} />
        <div className="lg:sticky lg:top-4">
          <CodePanel classId={classId} termId={currentTerm?.id ?? ''} />
        </div>
      </div>
    </div>
  )
}

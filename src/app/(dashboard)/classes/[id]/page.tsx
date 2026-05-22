import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, UserMinus, BookOpen, Calendar, Award } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { unenrolStudentAction } from '../actions'
import { format } from 'date-fns'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClassDetailPage({ params }: PageProps) {
  const user = await requireRole(['admin', 'teacher'])
  const { id } = await params

  const cls = await db.class.findUnique({
    where: { id },
    include: {
      academicYear: true,
      room: true,
      teachers: {
        include: { staff: { include: { user: true } } },
      },
      enrolments: {
        where: { status: 'active' },
        include: { student: { include: { user: true } } },
        orderBy: { student: { user: { name: 'asc' } } },
      },
      timetableSlots: {
        include: { room: true, staff: { include: { user: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      },
      gradebooks: {
        include: { term: true, _count: { select: { grades: true } } },
        orderBy: { dueDate: 'asc' },
      },
    },
  })

  if (!cls) notFound()

  const primaryTeacher = cls.teachers.find((t) => t.isPrimary)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/classes"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Classes
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{cls.name}</h1>
              <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {cls.code}
              </span>
              {cls.yearLevel && <Badge variant="secondary">Year {cls.yearLevel}</Badge>}
            </div>
            {cls.subject && <p className="text-slate-500 mt-1">{cls.subject}</p>}
          </div>
          {user.role === 'admin' && (
            <Link href={`/classes/${cls.id}/edit`} className={buttonVariants({ variant: 'outline' })}>Edit Class</Link>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Academic Year</p>
          <p className="font-semibold text-slate-800 mt-1">{cls.academicYear.year}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Room</p>
          <p className="font-semibold text-slate-800 mt-1">
            {cls.room ? `${cls.room.name} (${cls.room.code})` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Primary Teacher</p>
          <p className="font-semibold text-slate-800 mt-1">
            {primaryTeacher?.staff.user.name ?? '—'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">
            <BookOpen className="w-4 h-4 mr-2" />
            Students ({cls.enrolments.length})
          </TabsTrigger>
          <TabsTrigger value="timetable">
            <Calendar className="w-4 h-4 mr-2" />
            Timetable ({cls.timetableSlots.length})
          </TabsTrigger>
          <TabsTrigger value="gradebooks">
            <Award className="w-4 h-4 mr-2" />
            Gradebook ({cls.gradebooks.length})
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Student Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Year Level</TableHead>
                  <TableHead>Enrolled At</TableHead>
                  {user.role === 'admin' && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cls.enrolments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                      No students enrolled
                    </TableCell>
                  </TableRow>
                ) : (
                  cls.enrolments.map((enrolment) => (
                    <TableRow key={enrolment.id}>
                      <TableCell className="font-medium">
                        <Link href={`/students/${enrolment.student.id}`} className="hover:text-primary">
                          {enrolment.student.user.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-slate-600 text-sm">
                        {enrolment.student.studentId}
                      </TableCell>
                      <TableCell>
                        {enrolment.student.yearLevel ? `Year ${enrolment.student.yearLevel}` : '—'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {format(new Date(enrolment.enrolledAt), 'dd MMM yyyy')}
                      </TableCell>
                      {user.role === 'admin' && (
                        <TableCell className="text-right">
                          <form
                            action={async () => {
                              'use server'
                              await unenrolStudentAction(cls.id, enrolment.student.id)
                            }}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <UserMinus className="w-4 h-4 mr-1" />
                              Unenrol
                            </Button>
                          </form>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Timetable Tab */}
        <TabsContent value="timetable">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Day</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cls.timetableSlots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                      No timetable slots assigned
                    </TableCell>
                  </TableRow>
                ) : (
                  cls.timetableSlots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">
                        {DAY_NAMES[slot.dayOfWeek - 1]}
                      </TableCell>
                      <TableCell>Period {slot.period}</TableCell>
                      <TableCell className="text-slate-600">
                        {slot.startTime} – {slot.endTime}
                      </TableCell>
                      <TableCell>
                        {slot.room ? (
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                            {slot.room.code}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {slot.staff?.user.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{slot.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Gradebooks Tab */}
        <TabsContent value="gradebooks">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Assessment</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-center">Max Score</TableHead>
                  <TableHead className="text-center">Grades</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cls.gradebooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                      No assessments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  cls.gradebooks.map((gb) => (
                    <TableRow key={gb.id}>
                      <TableCell className="font-medium">{gb.name}</TableCell>
                      <TableCell className="text-slate-600">{gb.term.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{gb.type}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {gb.dueDate ? format(new Date(gb.dueDate), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-center">{gb.maxScore}</TableCell>
                      <TableCell className="text-center">{gb._count.grades}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/grades/${gb.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>View</Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChevronLeft,
  Pencil,
  User,
  Heart,
  FileText,
  BookOpen,
  CalendarCheck,
  Users,
  ArrowDownLeft,
  Download,
  StickyNote,
  LayoutGrid,
} from 'lucide-react'
import TransferInPanel from './transfer-in-panel'
import GuardianPanel from './guardian-panel'
import StudentNotes from './student-notes'
import StudentTimetable from './student-timetable'

type Params = Promise<{ id: string }>

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  graduated: { label: 'Graduated', variant: 'outline' },
  transferred: { label: 'Transferred', variant: 'outline' },
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value || <span className="text-slate-400 font-normal">—</span>}</dd>
    </div>
  )
}

export default async function StudentDetailPage({ params }: { params: Params }) {
  const session = await requireRole(['admin', 'teacher'])
  const { id } = await params

  const student = await db.student.findUnique({
    where: { id },
    include: {
      user: true,
      parents: {
        include: {
          parent: { include: { user: true } },
        },
      },
      classEnrolments: {
        include: { class: true },
        orderBy: { enrolledAt: 'desc' },
      },
      attendance: {
        orderBy: { date: 'desc' },
        take: 30,
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      transferIn: true,
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!student) notFound()

  const statusInfo = STATUS_LABELS[student.enrollmentStatus] ?? { label: student.enrollmentStatus, variant: 'outline' as const }

  // Parent engagement scoring (admin only)
  type EngagementData = {
    userId: string
    name: string
    loginActivity: 'active' | 'passive' | 'inactive' | 'never'
    noticeReadRate: number | null
    paymentPunctuality: number | null
    level: 'high' | 'medium' | 'low'
  }
  let parentEngagement: EngagementData[] = []
  if (session.role === 'admin' && student.parents.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const now = new Date()
    const parentUserIds = student.parents.map(p => p.parent.userId)

    const [recentNoticeCount, paidInvoices, reads] = await Promise.all([
      db.notice.count({
        where: {
          publishedAt: { not: null, gte: thirtyDaysAgo, lte: now },
          OR: [{ targetRoles: 'all' }, { targetRoles: { contains: 'parent' } }],
        },
      }),
      db.feeInvoice.findMany({
        where: { studentId: student.id, status: 'paid' },
        include: { payments: { orderBy: { paidAt: 'asc' }, take: 1 } },
      }),
      db.noticeRead.findMany({
        where: {
          userId: { in: parentUserIds },
          notice: { publishedAt: { not: null, gte: thirtyDaysAgo } },
        },
        select: { userId: true },
      }),
    ])

    const readCounts = new Map<string, number>()
    for (const r of reads) readCounts.set(r.userId, (readCounts.get(r.userId) ?? 0) + 1)

    const totalPaid = paidInvoices.length
    const onTimePaid = paidInvoices.filter(inv => {
      const fp = inv.payments[0]
      return fp && new Date(fp.paidAt) <= new Date(inv.dueDate)
    }).length
    const punctuality = totalPaid > 0 ? Math.round((onTimePaid / totalPaid) * 100) : null

    parentEngagement = student.parents.map(({ parent }) => {
      const lastLogin = (parent.user as { lastLoginAt?: Date | null }).lastLoginAt ?? null
      const loginActivity: EngagementData['loginActivity'] =
        !lastLogin ? 'never' :
        lastLogin > fourteenDaysAgo ? 'active' :
        lastLogin > sixtyDaysAgo ? 'passive' : 'inactive'

      const readsCount = readCounts.get(parent.userId) ?? 0
      const noticeReadRate = recentNoticeCount > 0
        ? Math.round((readsCount / recentNoticeCount) * 100)
        : null

      let good = 0
      if (loginActivity === 'active') good++
      if (noticeReadRate != null && noticeReadRate >= 50) good++
      if (punctuality != null && punctuality >= 80) good++

      return {
        userId: parent.userId,
        name: parent.user.name,
        loginActivity,
        noticeReadRate,
        paymentPunctuality: punctuality,
        level: good >= 2 ? 'high' : good === 1 ? 'medium' : 'low',
      }
    })
  }

  const timetableSlots = await db.timetableSlot.findMany({
    where: {
      class: { enrolments: { some: { studentId: student.id, status: 'active' } } },
    },
    include: { class: { select: { name: true } }, room: { select: { code: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
  })

  const visibleNotes = session.role === 'admin'
    ? student.notes
    : student.notes.filter((n) => !n.private)

  const totalAttendance = student.attendance.length
  const presentCount = student.attendance.filter((a) => a.status === 'present').length
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Students
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {student.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{student.user.name}</h1>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {student.studentId}
                {student.yearLevel ? ` · Year ${student.yearLevel}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/report-card/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              <Download className="w-4 h-4" />
              Report Card PDF
            </a>
            {session.role === 'admin' && (
              <>
                <a
                  href={`/api/export/student/${id}?format=json`}
                  className={buttonVariants({ variant: 'outline' })}
                  title="Export full student data as JSON (GDPR)"
                >
                  <Download className="w-4 h-4" />
                  Export Data
                </a>
                <Link href={`/students/${id}/edit`} className={buttonVariants({ variant: 'outline' })}>
                  <Pencil className="w-4 h-4" />
                  Edit Student
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="guardians">
            <Users className="w-4 h-4" />
            Guardians
          </TabsTrigger>
          <TabsTrigger value="medical">
            <Heart className="w-4 h-4" />
            Medical
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="enrolments">
            <BookOpen className="w-4 h-4" />
            Enrolments
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <CalendarCheck className="w-4 h-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="w-4 h-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="timetable">
            <LayoutGrid className="w-4 h-4" />
            Timetable
          </TabsTrigger>
          <TabsTrigger value="transfer">
            <ArrowDownLeft className="w-4 h-4" />
            Transfer In
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Personal</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Full Name" value={student.user.name} />
                  <DetailRow label="Email" value={student.user.email} />
                  <DetailRow label="Phone" value={student.user.phone} />
                  <DetailRow
                    label="Date of Birth"
                    value={
                      student.dateOfBirth
                        ? new Date(student.dateOfBirth).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
                        : null
                    }
                  />
                  <DetailRow label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null} />
                  <DetailRow label="Nationality" value={student.nationality} />
                  <DetailRow label="Address" value={student.address} />
                </dl>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Enrolment</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Student ID" value={student.studentId} />
                  <DetailRow label="Year Level" value={student.yearLevel ? `Year ${student.yearLevel}` : null} />
                  <DetailRow label="Status" value={statusInfo.label} />
                  <DetailRow
                    label="Enrolment Date"
                    value={new Date(student.enrollmentDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                </dl>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Name" value={student.emergencyName} />
                  <DetailRow label="Relationship" value={student.emergencyRelation} />
                  <DetailRow label="Phone" value={student.emergencyPhone} />
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Guardians Tab */}
        <TabsContent value="guardians" className="mt-4 space-y-6">
          <GuardianPanel
            studentId={student.id}
            guardians={student.parents}
            isAdmin={session.role === 'admin'}
          />
          {session.role === 'admin' && parentEngagement.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Guardian Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100">
                  {parentEngagement.map(p => {
                    const levelColors: Record<string, string> = {
                      high: 'bg-green-100 text-green-700',
                      medium: 'bg-amber-100 text-amber-700',
                      low: 'bg-red-100 text-red-700',
                    }
                    const loginLabels: Record<string, string> = {
                      active: 'Active (14d)',
                      passive: 'Passive (60d)',
                      inactive: 'Inactive (60d+)',
                      never: 'Never logged in',
                    }
                    return (
                      <div key={p.userId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{p.name}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${levelColors[p.level]}`}>
                            {p.level} engagement
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
                          <span>Login: <strong className="text-slate-700">{loginLabels[p.loginActivity]}</strong></span>
                          <span>Notices: <strong className="text-slate-700">{p.noticeReadRate != null ? `${p.noticeReadRate}%` : 'n/a'}</strong></span>
                          <span>On-time fees: <strong className="text-slate-700">{p.paymentPunctuality != null ? `${p.paymentPunctuality}%` : 'n/a'}</strong></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Medical Tab */}
        <TabsContent value="medical" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <dl>
                <DetailRow label="Medical Conditions" value={student.medicalConditions} />
                <DetailRow label="Allergies" value={student.allergies} />
                <DetailRow label="Current Medications" value={student.medications} />
                <DetailRow label="Doctor / GP" value={student.doctorName} />
                <DetailRow label="Doctor Phone" value={student.doctorPhone} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          {student.documents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
              No documents uploaded for this student.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-slate-900">{doc.name}</TableCell>
                      <TableCell className="text-slate-600">{doc.type}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {new Date(doc.uploadedAt).toLocaleDateString('en-NZ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Enrolments Tab */}
        <TabsContent value="enrolments" className="mt-4">
          {student.classEnrolments.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
              Not enrolled in any classes yet.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Class</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.classEnrolments.map((enrolment) => (
                    <TableRow key={enrolment.id}>
                      <TableCell className="font-medium text-slate-900">{enrolment.class.name}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">{enrolment.class.code}</TableCell>
                      <TableCell className="text-slate-600">{enrolment.class.subject ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={enrolment.status === 'active' ? 'default' : 'secondary'}>
                          {enrolment.status.charAt(0).toUpperCase() + enrolment.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {new Date(enrolment.enrolledAt).toLocaleDateString('en-NZ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <div className="space-y-4">
            {/* Summary card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Attendance Rate</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Last 30 records</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Days Present</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{presentCount}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Days Absent</p>
                  <p className="text-3xl font-bold text-red-500 mt-1">
                    {student.attendance.filter((a) => a.status === 'absent').length}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Late</p>
                  <p className="text-3xl font-bold text-amber-500 mt-1">
                    {student.attendance.filter((a) => a.status === 'late').length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Attendance list */}
            {student.attendance.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
                No attendance records found.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-slate-700 text-sm">
                          {new Date(record.date).toLocaleDateString('en-NZ', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === 'present'
                                ? 'default'
                                : record.status === 'absent'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{record.notes ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <StudentNotes
            studentId={student.id}
            notes={visibleNotes}
            currentUserId={session.id}
            isAdmin={session.role === 'admin'}
          />
        </TabsContent>

        {/* Timetable Tab */}
        <TabsContent value="timetable" className="mt-4">
          <StudentTimetable slots={timetableSlots} />
        </TabsContent>

        {/* Transfer In Tab */}
        <TabsContent value="transfer" className="mt-4">
          <TransferInPanel
            studentId={student.id}
            canEdit={session.role === 'admin'}
            transferIn={student.transferIn ? {
              previousSchool: student.transferIn.previousSchool,
              previousYearLevel: student.transferIn.previousYearLevel,
              transferDate: student.transferIn.transferDate,
              reason: student.transferIn.reason,
              documentsReceived: student.transferIn.documentsReceived,
              academicRecordsNotes: student.transferIn.academicRecordsNotes,
              notes: student.transferIn.notes,
            } : null}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

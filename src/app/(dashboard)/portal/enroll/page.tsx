import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import EnrollClassList from './enroll-class-list'

export default async function PortalEnrollPage() {
  const user = await requireSession()

  if (user.role === 'admin' || user.role === 'teacher') redirect('/classes')

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })
  if (!activeYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Class Enrollment</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No active academic year found. Please contact the school office.
        </div>
      </div>
    )
  }

  let studentId: string | null = null
  let studentName: string | null = null
  let childrenOptions: { id: string; name: string; yearLevel: number | null }[] = []

  if (user.role === 'student') {
    const student = await db.student.findUnique({ where: { userId: user.id } })
    if (!student) redirect('/portal')
    studentId = student.id
    studentName = user.name
  } else if (user.role === 'parent') {
    const parent = await db.parent.findUnique({
      where: { userId: user.id },
      include: { students: { include: { student: { include: { user: { select: { name: true } } } } } } },
    })
    childrenOptions = (parent?.students ?? []).map((ps) => ({
      id: ps.student.id,
      name: ps.student.user.name,
      yearLevel: ps.student.yearLevel,
    }))
    if (childrenOptions.length === 1) {
      studentId = childrenOptions[0].id
    }
  }

  // Load all classes for the active year
  const classes = await db.class.findMany({
    where: { academicYearId: activeYear.id },
    include: {
      teachers: { where: { isPrimary: true }, include: { staff: { include: { user: { select: { name: true } } } } } },
      _count: { select: { enrolments: { where: { status: 'active' } } } },
    },
    orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
  })

  // Load student's current enrollment state (requests, waitlist, enrolments)
  type EnrollmentStatus = Record<string, 'enrolled' | 'pending' | 'rejected' | 'waitlisted'>
  const statusMap: EnrollmentStatus = {}

  const resolveStatuses = async (sid: string) => {
    const [enrolments, requests, waitlist] = await Promise.all([
      db.classEnrolment.findMany({ where: { studentId: sid, status: 'active' } }),
      db.enrolmentRequest.findMany({ where: { studentId: sid } }),
      db.waitlistEntry.findMany({ where: { studentId: sid } }),
    ])
    for (const e of enrolments) statusMap[e.classId] = 'enrolled'
    for (const r of requests) {
      if (r.status === 'pending') statusMap[r.classId] = 'pending'
      else if (r.status === 'rejected') statusMap[r.classId] ??= 'rejected'
    }
    for (const w of waitlist) statusMap[w.classId] ??= 'waitlisted'
  }

  if (studentId) await resolveStatuses(studentId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Class Enrollment</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Browse available classes for {activeYear.year} and submit an enrollment request.
          Requests are reviewed by staff before you are officially enrolled.
        </p>
      </div>

      <EnrollClassList
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          subject: c.subject,
          yearLevel: c.yearLevel,
          maxStudents: c.maxStudents,
          enrolledCount: c._count.enrolments,
          primaryTeacher: c.teachers[0]?.staff.user.name ?? null,
          status: statusMap[c.id] ?? null,
        }))}
        studentId={studentId}
        userRole={user.role}
        childrenOptions={childrenOptions}
      />
    </div>
  )
}

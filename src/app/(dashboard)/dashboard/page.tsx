import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
  GraduationCap,
  Users,
  ClipboardCheck,
  DollarSign,
  BookOpen,
  Award,
  CalendarCheck,
  FileWarning,
  AlertTriangle,
} from 'lucide-react'

async function getAdminStats() {
  const [totalStudents, totalStaff, todayAttendance, outstandingFees] = await Promise.all([
    db.student.count({ where: { enrollmentStatus: 'active' } }),
    db.staff.count(),
    db.attendance.count({
      where: {
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: 'present',
      },
    }),
    db.feeInvoice.count({ where: { status: 'unpaid' } }),
  ])
  return { totalStudents, totalStaff, todayAttendance, outstandingFees }
}

async function getTeacherStats(userId: string) {
  const staff = await db.staff.findUnique({ where: { userId } })
  if (!staff) return { myClasses: 0, myStudents: 0, todayAttendance: 0, pendingGrades: 0 }

  const [myClasses, pendingGrades] = await Promise.all([
    db.classTeacher.count({ where: { staffId: staff.id } }),
    db.grade.count({ where: { gradedAt: null, gradebook: { class: { teachers: { some: { staffId: staff.id } } } } } }),
  ])

  return {
    myClasses,
    myStudents: 0, // placeholder
    todayAttendance: 0, // placeholder
    pendingGrades,
  }
}

type RiskFlag = 'attendance' | 'behaviour' | 'grades'
type AtRiskStudent = { id: string; name: string; yearLevel: number | null; flags: RiskFlag[] }

async function getAtRiskStudents(studentIdFilter?: string[]): Promise<AtRiskStudent[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const students = await db.student.findMany({
    where: {
      enrollmentStatus: 'active',
      ...(studentIdFilter ? { id: { in: studentIdFilter } } : {}),
    },
    select: {
      id: true,
      yearLevel: true,
      user: { select: { name: true } },
      attendance: {
        where: { date: { gte: thirtyDaysAgo } },
        select: { status: true },
      },
      behaviourIncidents: {
        where: { date: { gte: thirtyDaysAgo } },
        select: { id: true },
        take: 1,
      },
      grades: {
        where: { score: { not: null } },
        orderBy: { gradedAt: 'desc' },
        take: 3,
        select: { score: true },
      },
    },
  })

  const atRisk: AtRiskStudent[] = []
  for (const s of students) {
    const flags: RiskFlag[] = []
    const total = s.attendance.length
    if (total >= 5) {
      const present = s.attendance.filter(a => a.status === 'present').length
      if (present / total < 0.8) flags.push('attendance')
    }
    if (s.behaviourIncidents.length > 0) flags.push('behaviour')
    const scores = s.grades.map(g => g.score as number)
    if (scores.length === 3 && scores[2] > scores[1] && scores[1] > scores[0]) flags.push('grades')
    if (flags.length >= 2) atRisk.push({ id: s.id, name: s.user.name, yearLevel: s.yearLevel, flags })
  }
  atRisk.sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name))
  return atRisk.slice(0, 10)
}

const FLAG_LABELS: Record<RiskFlag, { label: string; className: string }> = {
  attendance: { label: 'Low Attendance', className: 'bg-orange-100 text-orange-700' },
  behaviour:  { label: 'Recent Incident', className: 'bg-red-100 text-red-700' },
  grades:     { label: 'Declining Grades', className: 'bg-amber-100 text-amber-700' },
}

function AtRiskWidget({ students }: { students: AtRiskStudent[] }) {
  if (students.length === 0) return null
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        At-Risk Students
      </h2>
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {students.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Link
                    href={`/students/${s.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-primary hover:underline truncate"
                  >
                    {s.name}
                  </Link>
                  {s.yearLevel != null && (
                    <span className="text-xs text-slate-400 shrink-0">Yr {s.yearLevel}</span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end shrink-0 ml-3">
                  {s.flags.map(f => (
                    <span key={f} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${FLAG_LABELS[f].className}`}>
                      {FLAG_LABELS[f].label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

type StatCardProps = {
  title: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
  color?: string
}

function StatCard({ title, value, description, icon: Icon, color = 'bg-primary/10 text-primary' }: StatCardProps) {
  return (
    <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const user = await requireSession()
  const settings = await db.schoolSettings.findFirst()
  const schoolName = settings?.name ?? 'Your School'

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? 'Good morning' :
    now.getHours() < 17 ? 'Good afternoon' :
    'Good evening'

  if (user.role === 'admin') {
    const [stats, atRiskStudents] = await Promise.all([getAdminStats(), getAtRiskStudents()])
    return (
      <div className="space-y-8">
        {/* Welcome banner */}
        <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 md:p-8 shadow-lg">
          <p className="text-primary-foreground/70 text-sm font-medium">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-0.5">{user.name}</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">{schoolName} &mdash; Administrator</p>
        </div>

        {/* Stats */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              description="Currently enrolled"
              icon={GraduationCap}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              title="Total Staff"
              value={stats.totalStaff}
              description="Staff members"
              icon={Users}
              color="bg-violet-100 text-violet-600"
            />
            <StatCard
              title="Today's Attendance"
              value={stats.todayAttendance}
              description="Present today"
              icon={ClipboardCheck}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              title="Outstanding Fees"
              value={stats.outstandingFees}
              description="Unpaid invoices"
              icon={DollarSign}
              color="bg-amber-100 text-amber-600"
            />
          </div>
        </div>

        {/* At-risk widget */}
        <AtRiskWidget students={atRiskStudents} />

        {/* Quick links */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Add Student', href: '/dashboard/students/new', icon: GraduationCap },
              { label: 'Take Attendance', href: '/dashboard/attendance', icon: ClipboardCheck },
              { label: 'View Reports', href: '/dashboard/reports', icon: Award },
              { label: 'Manage Staff', href: '/dashboard/staff', icon: Users },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 bg-white hover:border-primary/30 hover:shadow-sm transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <item.icon className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (user.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    const [stats, myStudentIds] = await Promise.all([
      getTeacherStats(user.id),
      staff
        ? db.classEnrolment
            .findMany({
              where: { status: 'active', class: { teachers: { some: { staffId: staff.id } } } },
              select: { studentId: true },
            })
            .then(es => [...new Set(es.map(e => e.studentId))])
        : Promise.resolve([] as string[]),
    ])
    const atRiskStudents = await getAtRiskStudents(myStudentIds)
    return (
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-white p-6 md:p-8 shadow-lg">
          <p className="text-white/70 text-sm font-medium">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-0.5">{user.name}</h1>
          <p className="text-white/80 text-sm mt-1">{schoolName} &mdash; Teacher</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="My Classes"
              value={stats.myClasses}
              description="Classes assigned"
              icon={BookOpen}
              color="bg-violet-100 text-violet-600"
            />
            <StatCard
              title="Students"
              value={stats.myStudents}
              description="In your classes"
              icon={GraduationCap}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              title="Today's Attendance"
              value={stats.todayAttendance}
              description="Marked present"
              icon={CalendarCheck}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              title="Pending Grades"
              value={stats.pendingGrades}
              description="Awaiting grading"
              icon={FileWarning}
              color="bg-amber-100 text-amber-600"
            />
          </div>
        </div>

        <AtRiskWidget students={atRiskStudents} />
      </div>
    )
  }

  if (user.role === 'parent') {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-6 md:p-8 shadow-lg">
          <p className="text-white/70 text-sm font-medium">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-0.5">{user.name}</h1>
          <p className="text-white/80 text-sm mt-1">{schoolName} &mdash; Parent Portal</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Children</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Children Enrolled"
              value="—"
              description="Active enrolments"
              icon={GraduationCap}
              color="bg-emerald-100 text-emerald-600"
            />
            <StatCard
              title="Attendance Rate"
              value="—"
              description="This term"
              icon={CalendarCheck}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              title="Latest Grades"
              value="—"
              description="Most recent results"
              icon={Award}
              color="bg-violet-100 text-violet-600"
            />
            <StatCard
              title="Notices"
              value="—"
              description="Unread notices"
              icon={BookOpen}
              color="bg-amber-100 text-amber-600"
            />
          </div>
        </div>
      </div>
    )
  }

  // Student
  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 text-white p-6 md:p-8 shadow-lg">
        <p className="text-white/70 text-sm font-medium">{greeting}</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-0.5">{user.name}</h1>
        <p className="text-white/80 text-sm mt-1">{schoolName} &mdash; Student Portal</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="My Classes"
            value="—"
            description="This term"
            icon={BookOpen}
            color="bg-sky-100 text-sky-600"
          />
          <StatCard
            title="Attendance"
            value="—"
            description="This term"
            icon={CalendarCheck}
            color="bg-green-100 text-green-600"
          />
          <StatCard
            title="Latest Grade"
            value="—"
            description="Most recent"
            icon={Award}
            color="bg-violet-100 text-violet-600"
          />
          <StatCard
            title="Notices"
            value="—"
            description="Unread"
            icon={BookOpen}
            color="bg-amber-100 text-amber-600"
          />
        </div>
      </div>
    </div>
  )
}

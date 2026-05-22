import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  GraduationCap,
  Users,
  ClipboardCheck,
  DollarSign,
  BookOpen,
  Award,
  CalendarCheck,
  FileWarning,
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
    const stats = await getAdminStats()
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
    const stats = await getTeacherStats(user.id)
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

import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, CalendarCheck, Award, Bell, DollarSign } from 'lucide-react'

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'bg-primary/10 text-primary',
}: {
  title: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <Card className="border-slate-100">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
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

export default async function PortalPage() {
  const user = await requireSession()

  // Admin and teachers go to their own dashboard
  if (user.role === 'admin' || user.role === 'teacher') {
    redirect('/dashboard')
  }

  const settings = await db.schoolSettings.findFirst()
  const schoolName = settings?.name ?? 'School Portal'
  const now = new Date()

  // ── Parent ───────────────────────────────────────────────────────────────────
  if (user.role === 'parent') {
    // Find parent record
    const parent = await db.parent.findUnique({
      where: { userId: user.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children = (parent?.students ?? []).map((ps: any) => ps.student as { id: string; yearLevel: number | null; studentId: string; user: { name: string } })

    // Gather stats per child
    const childStats = await Promise.all(
      children.map(async child => {
        const [totalDays, presentDays, recentGrades, outstandingInvoices] = await Promise.all([
          db.attendance.count({ where: { studentId: child.id } }),
          db.attendance.count({ where: { studentId: child.id, status: 'present' } }),
          db.grade.findMany({
            where: { studentId: child.id },
            orderBy: { gradedAt: 'desc' },
            take: 3,
            select: { score: true },
          }),
          db.feeInvoice.count({
            where: { studentId: child.id, status: { in: ['unpaid', 'partial', 'overdue'] } },
          }),
        ])

        const attendancePct =
          totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null

        const avgGrade =
          recentGrades.length > 0 && recentGrades.some(g => g.score != null)
            ? Math.round(
                recentGrades
                  .filter(g => g.score != null)
                  .reduce((s, g) => s + (g.score ?? 0), 0) /
                  recentGrades.filter(g => g.score != null).length,
              )
            : null

        return {
          id: child.id,
          name: child.user.name,
          yearLevel: child.yearLevel,
          attendancePct,
          avgGrade,
          outstandingInvoices,
        }
      }),
    )

    // Notices for parents
    const noticeCount = await db.notice.count({
      where: {
        AND: [
          { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          { OR: [{ targetRoles: 'all' }, { targetRoles: { contains: 'parent' } }] },
        ],
      },
    })

    return (
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-6 md:p-8 shadow-lg">
          <p className="text-white/70 text-sm font-medium">Welcome back</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-0.5">{user.name}</h1>
          <p className="text-white/80 text-sm mt-1">{schoolName} — Parent Portal</p>
        </div>

        {children.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-400">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No children linked to your account yet.</p>
              <p className="text-sm mt-1">Contact the school office to link your children.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800">Your Children</h2>
            {childStats.map(child => (
              <div key={child.id}>
                <h3 className="text-base font-semibold text-slate-700 mb-3">
                  {child.name}
                  {child.yearLevel != null && (
                    <span className="text-sm font-normal text-slate-400 ml-2">Year {child.yearLevel}</span>
                  )}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <StatCard
                    title="Attendance"
                    value={child.attendancePct != null ? `${child.attendancePct}%` : '—'}
                    description="This year"
                    icon={CalendarCheck}
                    color="bg-blue-100 text-blue-600"
                  />
                  <StatCard
                    title="Recent Average"
                    value={child.avgGrade != null ? `${child.avgGrade}%` : '—'}
                    description="Last 3 grades"
                    icon={Award}
                    color="bg-violet-100 text-violet-600"
                  />
                  <StatCard
                    title="Outstanding Fees"
                    value={child.outstandingInvoices}
                    description="Unpaid invoices"
                    icon={DollarSign}
                    color={child.outstandingInvoices > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}
                  />
                  <StatCard
                    title="Notices"
                    value={noticeCount}
                    description="School notices"
                    icon={Bell}
                    color="bg-amber-100 text-amber-600"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <Link
            href="/portal/notices"
            className="text-sm text-primary font-medium hover:underline"
          >
            View school notices →
          </Link>
          <Link
            href="/communication/messages"
            className="text-sm text-primary font-medium hover:underline"
          >
            View messages →
          </Link>
        </div>
      </div>
    )
  }

  // ── Student ──────────────────────────────────────────────────────────────────
  const student = await db.student.findUnique({
    where: { userId: user.id },
    include: { user: { select: { name: true } } },
  })

  if (!student) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p>Student profile not found. Please contact the school office.</p>
      </div>
    )
  }

  const [totalDays, presentDays, recentGrades, myClasses, noticeCount] = await Promise.all([
    db.attendance.count({ where: { studentId: student.id } }),
    db.attendance.count({ where: { studentId: student.id, status: 'present' } }),
    db.grade.findMany({
      where: { studentId: student.id },
      include: { gradebook: { include: { class: true } } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
    }),
    db.classEnrolment.count({ where: { studentId: student.id, status: 'active' } }),
    db.notice.count({
      where: {
        AND: [
          { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      },
    }),
  ])

  const attendancePct =
    totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null

  const avgGrade =
    recentGrades.length > 0 && recentGrades.some(g => g.score != null)
      ? Math.round(
          recentGrades
            .filter(g => g.score != null)
            .reduce((s, g) => s + (g.score ?? 0), 0) /
            recentGrades.filter(g => g.score != null).length,
        )
      : null

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 text-white p-6 md:p-8 shadow-lg">
        <p className="text-white/70 text-sm font-medium">Welcome back</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-0.5">{user.name}</h1>
        <p className="text-white/80 text-sm mt-1">
          {schoolName}
          {student.yearLevel != null && ` — Year ${student.yearLevel}`}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="My Classes"
            value={myClasses}
            description="Enrolled this term"
            icon={GraduationCap}
            color="bg-sky-100 text-sky-600"
          />
          <StatCard
            title="Attendance"
            value={attendancePct != null ? `${attendancePct}%` : '—'}
            description="This year"
            icon={CalendarCheck}
            color="bg-green-100 text-green-600"
          />
          <StatCard
            title="Recent Average"
            value={avgGrade != null ? `${avgGrade}%` : '—'}
            description="Last 5 grades"
            icon={Award}
            color="bg-violet-100 text-violet-600"
          />
          <StatCard
            title="Notices"
            value={noticeCount}
            description="School notices"
            icon={Bell}
            color="bg-amber-100 text-amber-600"
          />
        </div>
      </div>

      {recentGrades.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Recent Grades</h2>
          <div className="space-y-2">
            {recentGrades.map(grade => (
              <div key={grade.id} className="flex items-center justify-between bg-white rounded-lg border border-slate-100 px-4 py-3">
                <span className="text-sm text-slate-700">{grade.gradebook?.class?.name ?? 'Unknown class'}</span>
                <span className={`text-sm font-semibold ${
                  grade.score != null && grade.score >= 80
                    ? 'text-green-700'
                    : grade.score != null && grade.score >= 60
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}>
                  {grade.score != null ? `${grade.score}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <Link href="/portal/notices" className="text-sm text-primary font-medium hover:underline">
          View notices →
        </Link>
        <Link href="/communication/messages" className="text-sm text-primary font-medium hover:underline">
          View messages →
        </Link>
      </div>
    </div>
  )
}

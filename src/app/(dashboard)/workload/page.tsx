import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  FileText,
  ExternalLink,
} from 'lucide-react'

function fmt(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: Date) {
  const diff = new Date(d).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return `${Math.abs(days)}d overdue`
  return `in ${days}d`
}

export default async function WorkloadPage() {
  const user = await requireRole(['admin', 'teacher'])

  let staffId: string | null = null
  if (user.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    staffId = staff?.id ?? null
  }

  const classFilter = staffId
    ? { teachers: { some: { staffId } } }
    : {}

  // Load all gradebooks for teacher's classes
  const gradebooks = await db.gradebook.findMany({
    where: { class: classFilter },
    include: {
      class: { select: { id: true, name: true, code: true } },
      term: { select: { name: true } },
      grades: { select: { score: true, submittedAt: true, gradedAt: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  const now = new Date()

  // Submissions that need marking: submittedAt set, gradedAt null
  const pendingGrading = gradebooks
    .map((gb) => ({
      ...gb,
      pendingCount: gb.grades.filter((g) => g.submittedAt && !g.gradedAt).length,
      submittedCount: gb.grades.filter((g) => g.submittedAt).length,
      gradedCount: gb.grades.filter((g) => g.gradedAt).length,
    }))
    .filter((gb) => gb.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount)

  // Upcoming due dates (next 14 days)
  const upcoming = gradebooks.filter(
    (gb) => gb.dueDate && gb.dueDate > now && gb.dueDate < new Date(now.getTime() + 14 * 86400000),
  )

  // My classes with stats
  const classes = await db.class.findMany({
    where: classFilter,
    include: {
      _count: {
        select: {
          enrolments: { where: { status: 'active' } },
          gradebooks: true,
        },
      },
      teachers: {
        where: { isPrimary: true },
        include: { staff: { include: { user: { select: { name: true } } } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  const totalPending = pendingGrading.reduce((s, g) => s + g.pendingCount, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Workload</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Submissions waiting to be marked, upcoming due dates, and your classes at a glance.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Classes</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{classes.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Assessments</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{gradebooks.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">To Mark</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{totalPending}</p>
            <p className="text-xs text-slate-400 mt-0.5">submissions</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Due Soon</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{upcoming.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">next 14 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Required */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold text-slate-800">Action Required — Submissions to Mark</h2>
          {totalPending > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">{totalPending}</Badge>
          )}
        </div>

        {pendingGrading.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm shadow-sm">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-400" />
            All caught up — no submissions waiting to be marked.
          </div>
        ) : (
          <div className="space-y-2">
            {pendingGrading.map((gb) => (
              <div
                key={gb.id}
                className="flex items-center justify-between gap-4 bg-white border border-amber-200 rounded-xl px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{gb.name}</span>
                    <span className="text-xs text-slate-500">{gb.class.name}</span>
                    <Badge variant="secondary" className="text-xs">{gb.term.name}</Badge>
                    {gb.dueDate && (
                      <span className="text-xs text-slate-400">{daysUntil(gb.dueDate)}</span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {gb.pendingCount} submitted, not yet marked · {gb.gradedCount} graded
                  </p>
                </div>
                <Link
                  href={`/grades/${gb.id}`}
                  className={buttonVariants({ variant: 'default', size: 'sm' })}
                >
                  Mark Now
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming due dates */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-blue-500" />
          <h2 className="text-base font-semibold text-slate-800">Due in the Next 14 Days</h2>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm shadow-sm">
            No assessments due in the next 14 days.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {upcoming.map((gb) => {
                const submitted = gb.grades.filter((g) => g.submittedAt).length
                const total = gb.grades.length
                const pct = total > 0 ? Math.round((submitted / total) * 100) : 0
                return (
                  <div key={gb.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">{gb.name}</span>
                        <span className="text-xs text-slate-500">{gb.class.name}</span>
                        {gb.documentUrl && (
                          <a
                            href={gb.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Assignment Doc
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-blue-600 font-medium">
                          Due {fmt(gb.dueDate)} ({daysUntil(gb.dueDate!)})
                        </span>
                        <span className="text-xs text-slate-400">
                          {submitted}/{total} submitted ({pct}%)
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/grades/${gb.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <FileText className="w-3.5 h-3.5" /> View
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* My Classes */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-800">
            {user.role === 'admin' ? 'All Classes' : 'My Classes'}
          </h2>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm shadow-sm">
            No classes assigned.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classes.map((cls) => (
              <Link key={cls.id} href={`/classes/${cls.id}`}>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-primary/40 hover:shadow transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{cls.name}</p>
                      <p className="text-xs font-mono text-slate-500">{cls.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {cls._count.enrolments} students
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {cls._count.gradebooks} assessments
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

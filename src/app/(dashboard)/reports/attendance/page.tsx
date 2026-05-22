import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type SearchParams = {
  yearLevel?: string
  from?: string
  to?: string
  studentId?: string
}

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['admin'])

  const sp = await searchParams
  const yearLevel = sp.yearLevel ? parseInt(sp.yearLevel, 10) : undefined
  const from = sp.from ? new Date(sp.from) : undefined
  const to = sp.to ? new Date(sp.to) : undefined
  const studentId = sp.studentId ?? undefined

  // Fetch students matching filters
  const students = await db.student.findMany({
    where: {
      enrollmentStatus: 'active',
      ...(yearLevel ? { yearLevel } : {}),
      ...(studentId ? { id: studentId } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  // For each student, compute attendance stats
  const studentStats = await Promise.all(
    students.map(async student => {
      const whereDate = from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}

      const [total, present, absent, late] = await Promise.all([
        db.attendance.count({ where: { studentId: student.id, ...whereDate } }),
        db.attendance.count({ where: { studentId: student.id, status: 'present', ...whereDate } }),
        db.attendance.count({ where: { studentId: student.id, status: 'absent', ...whereDate } }),
        db.attendance.count({ where: { studentId: student.id, status: 'late', ...whereDate } }),
      ])

      const presentPct = total > 0 ? Math.round(((present + late) / total) * 100) : null

      return {
        id: student.id,
        name: student.user.name,
        yearLevel: student.yearLevel,
        total,
        present,
        absent,
        late,
        presentPct,
      }
    }),
  )

  const allStudents = await db.student.findMany({
    where: { enrollmentStatus: 'active' },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Attendance Report</h1>
            <p className="text-sm text-slate-500 mt-0.5">Student attendance summary</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-1.5">
            <Download className="w-3.5 h-3.5" />
            Export: print this page or use browser print-to-PDF
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form method="GET" className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">From Date</label>
              <input
                name="from"
                type="date"
                defaultValue={sp.from ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">To Date</label>
              <input
                name="to"
                type="date"
                defaultValue={sp.to ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Year Level</label>
              <select
                name="yearLevel"
                defaultValue={sp.yearLevel ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Years</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(y => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Student</label>
              <select
                name="studentId"
                defaultValue={sp.studentId ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Students</option>
                {allStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.user.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
            <Link
              href="/reports/attendance"
              className="text-sm text-slate-500 hover:text-slate-700 py-1.5"
            >
              Clear
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      {studentStats.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No students found for the selected filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Year</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Total Days</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Present</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Absent</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Late</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {studentStats.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {s.yearLevel != null ? `Y${s.yearLevel}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">{s.total}</td>
                  <td className="px-4 py-3 text-center text-green-700">{s.present}</td>
                  <td className="px-4 py-3 text-center text-red-600">{s.absent}</td>
                  <td className="px-4 py-3 text-center text-amber-600">{s.late}</td>
                  <td className="px-4 py-3 text-center">
                    {s.presentPct != null ? (
                      <span
                        className={`font-semibold ${
                          s.presentPct >= 90
                            ? 'text-green-700'
                            : s.presentPct >= 75
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {s.presentPct}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  excused: 'bg-blue-100 text-blue-700',
}

interface PageProps {
  searchParams: Promise<{
    studentId?: string
    classId?: string
    startDate?: string
    endDate?: string
  }>
}

export default async function AttendanceReportPage({ searchParams }: PageProps) {
  await requireRole(['admin'])
  const filters = await searchParams

  // Load filter options
  const [students, classes] = await Promise.all([
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    }),
    db.class.findMany({
      include: { academicYear: true },
      orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
    }),
  ])

  // Build query
  const startDate = filters.startDate ? new Date(filters.startDate) : undefined
  const endDate = filters.endDate ? new Date(filters.endDate) : undefined
  if (endDate) endDate.setHours(23, 59, 59, 999)

  let studentIds: string[] | undefined
  if (filters.classId) {
    const enrolments = await db.classEnrolment.findMany({
      where: { classId: filters.classId, status: 'active' },
      select: { studentId: true },
    })
    studentIds = enrolments.map((e) => e.studentId)
  }

  const records = await db.attendance.findMany({
    where: {
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      student: { include: { user: true } },
      term: true,
    },
    orderBy: [{ date: 'desc' }, { student: { user: { name: 'asc' } } }],
    take: 500,
  })

  // Summary stats
  const summary = {
    present: records.filter((r: { status: string }) => r.status === 'present').length,
    absent: records.filter((r: { status: string }) => r.status === 'absent').length,
    late: records.filter((r: { status: string }) => r.status === 'late').length,
    excused: records.filter((r: { status: string }) => r.status === 'excused').length,
  }

  // Per-student breakdown
  const studentSummary = new Map<string, { name: string; present: number; absent: number; late: number; excused: number }>()
  for (const rec of records) {
    const key = rec.studentId
    if (!studentSummary.has(key)) {
      studentSummary.set(key, { name: rec.student.user.name, present: 0, absent: 0, late: 0, excused: 0 })
    }
    const entry = studentSummary.get(key)!
    switch (rec.status) {
      case 'present': entry.present++; break
      case 'absent': entry.absent++; break
      case 'late': entry.late++; break
      case 'excused': entry.excused++; break
    }
  }

  const studentRows = Array.from(studentSummary.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

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
        <h1 className="text-2xl font-bold text-slate-900">Attendance Report</h1>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Student</label>
            <select
              name="studentId"
              defaultValue={filters.studentId ?? ''}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.user.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Class</label>
            <select
              name="classId"
              defaultValue={filters.classId ?? ''}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Start Date</label>
            <input
              type="date"
              name="startDate"
              defaultValue={filters.startDate ?? ''}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">End Date</label>
            <input
              type="date"
              name="endDate"
              defaultValue={filters.endDate ?? ''}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Apply Filters
          </button>
          <Link
            href="/attendance/report"
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Summary totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: summary.present, color: 'text-green-600' },
          { label: 'Absent', value: summary.absent, color: 'text-red-600' },
          { label: 'Late', value: summary.late, color: 'text-yellow-600' },
          { label: 'Excused', value: summary.excused, color: 'text-blue-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Per-student summary */}
      {studentRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Student Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium text-slate-600">Student</th>
                  <th className="text-center px-4 py-3 font-medium text-green-600">Present</th>
                  <th className="text-center px-4 py-3 font-medium text-red-600">Absent</th>
                  <th className="text-center px-4 py-3 font-medium text-yellow-600">Late</th>
                  <th className="text-center px-4 py-3 font-medium text-blue-600">Excused</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {studentRows.map((row) => {
                  const total = row.present + row.absent + row.late + row.excused
                  const rate = total > 0 ? Math.round(((row.present + row.late) / total) * 100) : 0
                  return (
                    <tr key={row.name} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="text-center px-4 py-3 text-green-700 font-medium">{row.present}</td>
                      <td className="text-center px-4 py-3 text-red-600 font-medium">{row.absent}</td>
                      <td className="text-center px-4 py-3 text-yellow-600 font-medium">{row.late}</td>
                      <td className="text-center px-4 py-3 text-blue-600 font-medium">{row.excused}</td>
                      <td className="text-center px-4 py-3 text-slate-700">{total}</td>
                      <td className="text-center px-4 py-3">
                        <span className={`font-medium ${rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Detailed Records</h2>
          <span className="text-sm text-slate-500">{records.length} records</span>
        </div>
        {records.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No attendance records found for the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium text-slate-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Term</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {rec.student.user.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {format(new Date(rec.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{rec.term.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[rec.status] + ' border-0 capitalize'}>
                        {rec.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{rec.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

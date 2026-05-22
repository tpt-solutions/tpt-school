import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type SearchParams = {
  classId?: string
  termId?: string
}

export default async function GradesReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['admin'])

  const sp = await searchParams
  const classId = sp.classId ?? undefined
  const termId = sp.termId ?? undefined

  const [classes, terms] = await Promise.all([
    db.class.findMany({ orderBy: { name: 'asc' } }),
    db.term.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { year: 'desc' } }, { termNumber: 'asc' }],
    }),
  ])

  // Fetch gradebooks with grades, filtered by class/term if provided
  const gradebooks = await db.gradebook.findMany({
    where: {
      ...(classId ? { classId } : {}),
      ...(termId ? { termId } : {}),
    },
    include: {
      class: true,
      term: { include: { academicYear: true } },
      grades: {
        include: {
          student: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { class: { name: 'asc' } },
  })

  // Build rows: per student, average score across gradebooks
  type StudentRow = { id: string; name: string; scores: number[]; avg: number | null }
  const studentMap = new Map<string, StudentRow>()

  for (const gb of gradebooks) {
    for (const grade of gb.grades) {
      const existing = studentMap.get(grade.studentId)
      const score = grade.score != null ? grade.score : null
      if (existing) {
        if (score != null) existing.scores.push(score)
      } else {
        studentMap.set(grade.studentId, {
          id: grade.studentId,
          name: grade.student.user.name,
          scores: score != null ? [score] : [],
          avg: null,
        })
      }
    }
  }

  const rows = Array.from(studentMap.values()).map(row => ({
    ...row,
    avg: row.scores.length > 0
      ? Math.round(row.scores.reduce((s, n) => s + n, 0) / row.scores.length * 10) / 10
      : null,
  })).sort((a, b) => a.name.localeCompare(b.name))

  const classAvg = rows.length > 0
    ? Math.round(
        rows.filter(r => r.avg != null).reduce((s, r) => s + (r.avg ?? 0), 0) /
          rows.filter(r => r.avg != null).length * 10,
      ) / 10
    : null

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
            <h1 className="text-2xl font-bold text-slate-900">Grade Summary</h1>
            <p className="text-sm text-slate-500 mt-0.5">Student grades by class and term</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-1.5">
            <Download className="w-3.5 h-3.5" />
            Export: use browser print-to-PDF
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form method="GET" className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Class</label>
              <select
                name="classId"
                defaultValue={sp.classId ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Term</label>
              <select
                name="termId"
                defaultValue={sp.termId ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Terms</option>
                {terms.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.academicYear.year} — {t.name}
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
              href="/reports/grades"
              className="text-sm text-slate-500 hover:text-slate-700 py-1.5"
            >
              Clear
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No grade data found for the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Grades Recorded</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Average Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{row.scores.length}</td>
                  <td className="px-4 py-3 text-center">
                    {row.avg != null ? (
                      <span
                        className={`font-semibold ${
                          row.avg >= 80
                            ? 'text-green-700'
                            : row.avg >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {row.avg}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Class Average Row */}
              <tr className="bg-slate-100 font-semibold">
                <td className="px-4 py-3 text-slate-700">Class Average</td>
                <td className="px-4 py-3 text-center text-slate-700">
                  {rows.reduce((s, r) => s + r.scores.length, 0)}
                </td>
                <td className="px-4 py-3 text-center">
                  {classAvg != null ? (
                    <span className="text-slate-900">{classAvg}%</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft, Download, FileText, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PublishReportCards from './publish-report-cards'

type SearchParams = { termId?: string; yearLevel?: string }

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['admin'])

  const sp = await searchParams
  const termId = sp.termId ?? undefined
  const yearLevel = sp.yearLevel ? parseInt(sp.yearLevel) : undefined

  const [terms, students, settings] = await Promise.all([
    db.term.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { year: 'desc' } }, { termNumber: 'asc' }],
    }),
    db.student.findMany({
      where: {
        enrollmentStatus: 'active',
        ...(yearLevel ? { yearLevel } : {}),
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: [{ yearLevel: 'asc' }, { user: { name: 'asc' } }],
    }),
    db.schoolSettings.findFirst({ select: { aiProvider: true, aiReportMode: true } }),
  ])
  const aiEnabled = !!settings?.aiProvider && settings.aiProvider !== 'none'

  const yearLevels = [...new Set(students.map(s => s.yearLevel).filter((y): y is number => y !== null))].sort((a, b) => a - b)

  const termQuery = termId ? `?termId=${termId}` : ''

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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report Cards</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate and download student report cards as PDF.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form method="GET" className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Filter by Term</label>
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
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Year Level</label>
              <select
                name="yearLevel"
                defaultValue={sp.yearLevel ?? ''}
                className="border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Years</option>
                {yearLevels.map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
            <Link href="/reports/report-cards" className="text-sm text-slate-500 hover:text-slate-700 py-1.5">
              Clear
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Publish controls */}
      {termId && (
        <PublishReportCards
          termId={termId}
          aiEnabled={aiEnabled}
          aiMode={settings?.aiReportMode ?? 'assist'}
        />
      )}

      {/* Student list */}
      {students.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No active students found.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Student ID</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Year Level</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {s.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{s.user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{s.studentId}</td>
                  <td className="px-4 py-3 text-center">
                    {s.yearLevel ? (
                      <Badge variant="outline">Year {s.yearLevel}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/reports/report-cards/${s.id}${termId ? `?termId=${termId}` : ''}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md px-3 py-1.5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                      <a
                        href={`/api/report-card/${s.id}${termQuery}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-md px-3 py-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <FileText className="w-3.5 h-3.5" />
            {students.length} student{students.length !== 1 ? 's' : ''} — Edit to add comments{aiEnabled ? ' or generate with AI' : ''}, then download PDF
          </div>
        </div>
      )}
    </div>
  )
}

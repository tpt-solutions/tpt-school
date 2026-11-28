import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STATUS_ORDER = ['active', 'inactive', 'graduated', 'transferred']
const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  graduated: 'Graduated',
  transferred: 'Transferred',
}

export default async function EnrolmentReportPage() {
  await requireRole(['admin'])

  const groups = await db.student.groupBy({
    by: ['yearLevel', 'enrollmentStatus'],
    _count: { _all: true },
  })

  // Rows are year levels (unknown last); columns are the statuses the school uses
  const statuses = Array.from(new Set([...STATUS_ORDER, ...groups.map((g) => g.enrollmentStatus)]))
  const levels = Array.from(new Set(groups.map((g) => g.yearLevel))).sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })

  const cell = (level: number | null, status: string) =>
    groups.find((g) => g.yearLevel === level && g.enrollmentStatus === status)?._count._all ?? 0
  const rowTotal = (level: number | null) =>
    groups.filter((g) => g.yearLevel === level).reduce((sum, g) => sum + g._count._all, 0)
  const colTotal = (status: string) =>
    groups.filter((g) => g.enrollmentStatus === status).reduce((sum, g) => sum + g._count._all, 0)
  const grandTotal = groups.reduce((sum, g) => sum + g._count._all, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/reports" className="mb-2 inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="mr-1 h-4 w-4" /> All reports
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Student enrolment</h1>
        <p className="mt-1 text-sm text-slate-500">{grandTotal} students in total, by year level and status.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By year level</CardTitle></CardHeader>
        <CardContent>
          {grandTotal === 0 ? (
            <p className="text-sm text-slate-500">No students yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-stack">
                <caption className="sr-only">Student counts by year level and enrolment status</caption>
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th scope="col" className="py-2 pr-4 font-medium">Year level</th>
                    {statuses.map((s) => (
                      <th key={s} scope="col" className="py-2 pr-4 text-right font-medium">{STATUS_LABEL[s] ?? s}</th>
                    ))}
                    <th scope="col" className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level) => (
                    <tr key={String(level)} className="border-b last:border-0">
                      <td data-label="Year level" className="py-2 pr-4">{level === null ? 'Not set' : `Year ${level}`}</td>
                      {statuses.map((s) => (
                        <td key={s} data-label={STATUS_LABEL[s] ?? s} className="py-2 pr-4 text-right">{cell(level, s)}</td>
                      ))}
                      <td data-label="Total" className="py-2 text-right font-medium">{rowTotal(level)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td data-label="Total" className="py-2 pr-4">Total</td>
                    {statuses.map((s) => (
                      <td key={s} data-label={STATUS_LABEL[s] ?? s} className="py-2 pr-4 text-right">{colTotal(s)}</td>
                    ))}
                    <td data-label="Total" className="py-2 text-right">{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

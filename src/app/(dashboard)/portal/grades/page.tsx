import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { linkedStudentsFor } from '@/lib/portal'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function PortalGradesPage() {
  const user = await requireRole(['parent', 'student'])
  const children = await linkedStudentsFor(user)

  const grades = await Promise.all(
    children.map(child =>
      db.grade.findMany({
        where: { studentId: child.id, OR: [{ score: { not: null } }, { grade: { not: null } }] },
        include: {
          gradebook: { include: { class: { select: { name: true } }, term: { select: { name: true } } } },
        },
        orderBy: { gradedAt: 'desc' },
        take: 100,
      }),
    ),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Grades</h1>
        <p className="text-sm text-slate-500">Recent results for {children.length === 1 ? 'your child' : 'your children'}.</p>
      </div>

      {children.length === 0 && (
        <Card><CardContent className="py-8 text-center text-slate-400">No students are linked to your account yet.</CardContent></Card>
      )}

      {children.map((child, i) => (
        <Card key={child.id} className="border-slate-100">
          <CardHeader>
            <CardTitle className="text-base">
              {child.name}
              {child.yearLevel != null && <span className="ml-2 text-sm font-normal text-slate-400">Year {child.yearLevel}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {grades[i].length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No grades have been recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-stack">
                  <caption className="sr-only">My grades</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Graded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades[i].map(g => (
                      <TableRow key={g.id}>
                        <TableCell data-label="Assessment" className="font-medium">{g.gradebook.name}</TableCell>
                        <TableCell data-label="Class">{g.gradebook.class.name}</TableCell>
                        <TableCell data-label="Term">{g.gradebook.term.name}</TableCell>
                        <TableCell data-label="Score">{g.score != null ? `${g.score} / ${g.gradebook.maxScore}` : '—'}</TableCell>
                        <TableCell data-label="Grade">{g.grade ?? '—'}</TableCell>
                        <TableCell data-label="Comment" className="max-w-xs whitespace-normal text-slate-600">{g.comment ?? ''}</TableCell>
                        <TableCell data-label="Graded" className="text-slate-500">{g.gradedAt ? format(g.gradedAt, 'd MMM yyyy') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { linkedStudentsFor } from '@/lib/portal'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default async function PortalReportCardsPage() {
  const user = await requireRole(['parent', 'student'])
  const children = await linkedStudentsFor(user)

  // Families only see published report cards.
  const rawCards = await Promise.all(
    children.map(child =>
      db.reportCard.findMany({
        where: { studentId: child.id, published: true },
        orderBy: [{ academicYear: 'desc' }],
      }),
    ),
  )

  // ReportCard has no relation to Term, so look up the term names in one query.
  const termIds = [...new Set(rawCards.flat().map(c => c.termId))]
  const terms = termIds.length
    ? await db.term.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true, termNumber: true } })
    : []
  const termById = new Map(terms.map(t => [t.id, t]))

  const cards = rawCards.map(list =>
    list
      .map(card => ({ ...card, termName: termById.get(card.termId)?.name ?? 'Term' }))
      .sort((a, b) => (termById.get(a.termId)?.termNumber ?? 0) - (termById.get(b.termId)?.termNumber ?? 0)),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Report cards</h1>
        <p className="text-sm text-slate-500">Published report cards are available to download as PDF.</p>
      </div>

      {children.length === 0 && (
        <Card><CardContent className="py-8 text-center text-slate-400">No students are linked to your account yet.</CardContent></Card>
      )}

      {children.map((child, i) => (
        <Card key={child.id} className="border-slate-100">
          <CardHeader>
            <CardTitle className="text-base">{child.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {cards[i].length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No report cards have been published yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cards[i].map(card => (
                  <li key={card.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{card.termName} — {card.academicYear}</p>
                      <p className="text-xs text-slate-500">
                        {card.issuedAt ? `Issued ${format(card.issuedAt, 'd MMM yyyy')}` : 'Published'}
                      </p>
                    </div>
                    <Link
                      href={`/api/report-card/${child.id}?termId=${card.termId}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <Download className="mr-1 h-4 w-4" /> PDF
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

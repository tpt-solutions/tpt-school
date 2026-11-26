import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { addLibraryBookAction, checkoutBookAction, returnBookAction } from './actions'

export default async function LibraryPage() {
  await requireRole(['admin'])

  const now = new Date()
  const [books, students, openLoans] = await Promise.all([
    db.libraryBook.findMany({
      include: { loans: { where: { returnedAt: null }, select: { id: true } } },
      orderBy: { title: 'asc' },
      take: 1000,
    }),
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 2000,
    }),
    db.libraryLoan.findMany({
      where: { returnedAt: null },
      include: {
        book: { select: { title: true } },
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { dueDate: 'asc' },
      take: 500,
    }),
  ])

  const defaultDue = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const overdue = openLoans.filter((l) => l.dueDate.getTime() < now.getTime())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Library</h1>
        <p className="text-sm text-slate-500 mt-1">
          {books.length} title{books.length === 1 ? '' : 's'} · {openLoans.length} on loan · {overdue.length} overdue
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Add a book</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={addLibraryBookAction} submitLabel="Add book">
              <Field label="Title *" htmlFor="title"><input id="title" name="title" required maxLength={200} className={controlClass} /></Field>
              <Field label="Author" htmlFor="author"><input id="author" name="author" maxLength={120} className={controlClass} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Field label="ISBN" htmlFor="isbn"><input id="isbn" name="isbn" maxLength={20} className={controlClass} /></Field></div>
                <Field label="Copies *" htmlFor="copies"><input id="copies" name="copies" type="number" min={1} max={500} defaultValue={1} required className={controlClass} /></Field>
              </div>
              <Field label="Category" htmlFor="category"><input id="category" name="category" maxLength={60} className={controlClass} /></Field>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Check out a book</CardTitle></CardHeader>
          <CardContent>
            {books.length === 0 ? (
              <p className="text-sm text-slate-500">Add a book first.</p>
            ) : (
              <ActionForm action={checkoutBookAction} submitLabel="Check out">
                <Field label="Book *" htmlFor="bookId">
                  <select id="bookId" name="bookId" required defaultValue="" className={controlClass}>
                    <option value="" disabled>Select book…</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.loans.length >= b.copies}>
                        {b.title} ({Math.max(0, b.copies - b.loans.length)} free)
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Student *" htmlFor="studentId">
                  <select id="studentId" name="studentId" required defaultValue="" className={controlClass}>
                    <option value="" disabled>Select student…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.user.name} ({s.studentId})</option>)}
                  </select>
                </Field>
                <Field label="Due date *" htmlFor="dueDate">
                  <input id="dueDate" name="dueDate" type="date" defaultValue={defaultDue} required className={controlClass} />
                </Field>
              </ActionForm>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">On loan</CardTitle></CardHeader>
        <CardContent>
          {openLoans.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing is on loan.</p>
          ) : (
            <ul className="divide-y">
              {openLoans.map((l) => {
                const isOverdue = l.dueDate.getTime() < now.getTime()
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium text-slate-900">{l.book.title}</div>
                      <div className="text-sm text-slate-600">
                        {l.student.user.name} · due {l.dueDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                      <ActionForm action={returnBookAction} submitLabel="Mark returned" variant="outline" hidden={{ id: l.id }} resetOnSuccess={false}>
                        {null}
                      </ActionForm>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

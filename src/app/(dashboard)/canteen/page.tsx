import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { createCanteenItemAction, setCanteenItemActiveAction, recordCanteenPurchaseAction } from './actions'

export default async function CanteenPage() {
  await requireRole(['admin'])

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [items, students, recent, todayTotal] = await Promise.all([
    db.canteenItem.findMany({ orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] }),
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 2000,
    }),
    db.canteenPurchase.findMany({
      include: {
        item: { select: { name: true } },
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { purchasedAt: 'desc' },
      take: 50,
    }),
    db.canteenPurchase.aggregate({
      where: { purchasedAt: { gte: startOfToday } },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
  ])

  const activeItems = items.filter((i) => i.active)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Canteen</h1>
        <p className="text-sm text-slate-500 mt-1">
          Menu items and purchases. Today: {todayTotal._count._all} purchase{todayTotal._count._all === 1 ? '' : 's'},{' '}
          {formatCents(todayTotal._sum.totalCents ?? 0)}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Record a purchase</CardTitle></CardHeader>
          <CardContent>
            {activeItems.length === 0 ? (
              <p className="text-sm text-slate-500">Add a menu item first.</p>
            ) : (
              <ActionForm action={recordCanteenPurchaseAction} submitLabel="Record purchase">
                <Field label="Student *" htmlFor="studentId">
                  <select id="studentId" name="studentId" required defaultValue="" className={controlClass}>
                    <option value="" disabled>Select student…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.user.name} ({s.studentId})</option>)}
                  </select>
                </Field>
                <Field label="Item *" htmlFor="itemId">
                  <select id="itemId" name="itemId" required defaultValue="" className={controlClass}>
                    <option value="" disabled>Select item…</option>
                    {activeItems.map((i) => <option key={i.id} value={i.id}>{i.name} — {formatCents(i.priceCents)}</option>)}
                  </select>
                </Field>
                <Field label="Quantity" htmlFor="quantity">
                  <input id="quantity" name="quantity" type="number" min={1} max={20} defaultValue={1} required className={controlClass} />
                </Field>
              </ActionForm>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Add a menu item</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={createCanteenItemAction} submitLabel="Add item">
              <Field label="Name *" htmlFor="name"><input id="name" name="name" required maxLength={100} className={controlClass} /></Field>
              <Field label="Category" htmlFor="category"><input id="category" name="category" maxLength={50} placeholder="food, drink…" className={controlClass} /></Field>
              <Field label="Price (e.g. 3.50) *" htmlFor="price"><input id="price" name="price" required inputMode="decimal" className={controlClass} /></Field>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Menu</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">No menu items yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <span className={i.active ? 'font-medium text-slate-900' : 'text-slate-400 line-through'}>{i.name}</span>
                    <span className="ml-2 text-sm text-slate-500">{formatCents(i.priceCents)} · {i.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!i.active && <Badge variant="outline">Off sale</Badge>}
                    <ActionForm action={setCanteenItemActiveAction} submitLabel={i.active ? 'Take off sale' : 'Put on sale'} variant="outline" hidden={{ id: i.id, active: i.active ? 'false' : 'true' }} resetOnSuccess={false}>
                      {null}
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent purchases</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No purchases recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-stack">
                <caption className="sr-only">Recent canteen purchases</caption>
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th scope="col" className="py-2 pr-4 font-medium">When</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Item</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Qty</th>
                    <th scope="col" className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td data-label="When" className="py-2 pr-4 whitespace-nowrap text-slate-600">{p.purchasedAt.toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td data-label="Student" className="py-2 pr-4">{p.student.user.name}</td>
                      <td data-label="Item" className="py-2 pr-4">{p.item.name}</td>
                      <td data-label="Qty" className="py-2 pr-4">{p.quantity}</td>
                      <td data-label="Total" className="py-2 text-right">{formatCents(p.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default async function ParentEngagementPage() {
  await requireRole(['admin'])

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const parents = await db.parent.findMany({
    include: {
      user: true,
      students: { include: { student: { include: { user: { select: { name: true } } } } } },
    },
    orderBy: { user: { name: 'asc' } },
  })

  const [recentNoticeCount, allReads, paidInvoices] = await Promise.all([
    db.notice.count({
      where: {
        publishedAt: { not: null, gte: thirtyDaysAgo, lte: now },
        OR: [{ targetRoles: 'all' }, { targetRoles: { contains: 'parent' } }],
      },
    }),
    db.noticeRead.findMany({
      where: {
        userId: { in: parents.map(p => p.userId) },
        notice: { publishedAt: { not: null, gte: thirtyDaysAgo } },
      },
      select: { userId: true },
    }),
    db.feeInvoice.findMany({
      where: {
        status: 'paid',
        student: {
          parents: { some: { parent: { userId: { in: parents.map(p => p.userId) } } } },
        },
      },
      include: {
        student: { include: { parents: { select: { parent: { select: { userId: true } } } } } },
        payments: { orderBy: { paidAt: 'asc' }, take: 1 },
      },
    }),
  ])

  const readsByUser = new Map<string, number>()
  for (const r of allReads) readsByUser.set(r.userId, (readsByUser.get(r.userId) ?? 0) + 1)

  // Group paid invoices by parent userId
  const invoicesByParent = new Map<string, { total: number; onTime: number }>()
  for (const inv of paidInvoices) {
    const firstPay = inv.payments[0]
    const onTime = firstPay && new Date(firstPay.paidAt) <= new Date(inv.dueDate)
    for (const sp of inv.student.parents) {
      const uid = sp.parent.userId
      const existing = invoicesByParent.get(uid) ?? { total: 0, onTime: 0 }
      invoicesByParent.set(uid, { total: existing.total + 1, onTime: existing.onTime + (onTime ? 1 : 0) })
    }
  }

  type Row = {
    id: string
    userId: string
    name: string
    children: string[]
    loginActivity: 'active' | 'passive' | 'inactive' | 'never'
    noticeReadRate: number | null
    paymentPunctuality: number | null
    level: 'high' | 'medium' | 'low'
  }

  const rows: Row[] = parents.map(p => {
    const lastLogin = (p.user as { lastLoginAt?: Date | null }).lastLoginAt ?? null
    const loginActivity: Row['loginActivity'] =
      !lastLogin ? 'never' :
      lastLogin > fourteenDaysAgo ? 'active' :
      lastLogin > sixtyDaysAgo ? 'passive' : 'inactive'

    const reads = readsByUser.get(p.userId) ?? 0
    const noticeReadRate = recentNoticeCount > 0
      ? Math.round((reads / recentNoticeCount) * 100)
      : null

    const invData = invoicesByParent.get(p.userId)
    const paymentPunctuality = invData && invData.total > 0
      ? Math.round((invData.onTime / invData.total) * 100)
      : null

    let good = 0
    if (loginActivity === 'active') good++
    if (noticeReadRate != null && noticeReadRate >= 50) good++
    if (paymentPunctuality != null && paymentPunctuality >= 80) good++

    return {
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      children: p.students.map(s => s.student.user.name),
      loginActivity,
      noticeReadRate,
      paymentPunctuality,
      level: good >= 2 ? 'high' : good === 1 ? 'medium' : 'low',
    }
  })

  rows.sort((a, b) => {
    const order = { low: 0, medium: 1, high: 2 }
    return order[a.level] - order[b.level] || a.name.localeCompare(b.name)
  })

  const LEVEL_COLORS: Record<string, string> = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  }
  const LOGIN_LABELS: Record<string, string> = {
    active: 'Active',
    passive: 'Passive',
    inactive: 'Inactive',
    never: 'Never',
  }
  const LOGIN_COLORS: Record<string, string> = {
    active: 'text-green-700',
    passive: 'text-amber-600',
    inactive: 'text-red-600',
    never: 'text-slate-400',
  }

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
        <h1 className="text-2xl font-bold text-slate-900">Parent Engagement</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Engagement scored on: login activity (last 14 days = active), notice read rate (last 30 days), and fee payment punctuality.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(['high', 'medium', 'low'] as const).map(lvl => (
          <Card key={lvl} className="border-slate-100">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-slate-900">
                {rows.filter(r => r.level === lvl).length}
              </div>
              <div className={`text-xs font-medium mt-0.5 capitalize ${LEVEL_COLORS[lvl].split(' ')[1]}`}>
                {lvl} engagement
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Parent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Children</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Login</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Notices Read</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fees On Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{row.children.join(', ') || '—'}</td>
                  <td className={`px-4 py-3 font-medium ${LOGIN_COLORS[row.loginActivity]}`}>
                    {LOGIN_LABELS[row.loginActivity]}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.noticeReadRate != null ? `${row.noticeReadRate}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.paymentPunctuality != null ? `${row.paymentPunctuality}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${LEVEL_COLORS[row.level]}`}>
                      {row.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="text-center py-12 text-slate-400">No parents found.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

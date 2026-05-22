import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, Pin, ChevronLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700',
  event: 'bg-blue-100 text-blue-700',
  urgent: 'bg-red-100 text-red-700',
  academic: 'bg-violet-100 text-violet-700',
}

export default async function PortalNoticesPage() {
  const user = await requireSession()

  const now = new Date()

  // Filter notices to user's role
  const notices = await db.notice.findMany({
    where: {
      AND: [
        { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ...(user.role !== 'admin' && user.role !== 'teacher'
          ? [{ OR: [{ targetRoles: 'all' }, { targetRoles: { contains: user.role } }] }]
          : []),
      ],
    },
    include: { author: { select: { name: true } } },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Portal
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">School Notices</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {notices.length} notice{notices.length !== 1 ? 's' : ''} for you
        </p>
      </div>

      {notices.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">No notices at the moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(notice => (
            <Link key={notice.id} href={`/communication/notices/${notice.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-100">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-3">
                    {notice.pinned && (
                      <Pin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            CATEGORY_COLORS[notice.category] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {notice.category.charAt(0).toUpperCase() + notice.category.slice(1)}
                        </span>
                        {notice.pinned && (
                          <span className="text-xs font-medium text-amber-600">Pinned</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 truncate">{notice.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{notice.body}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {notice.author.name} &middot;{' '}
                        {notice.publishedAt ? formatDistanceToNow(new Date(notice.publishedAt), { addSuffix: true }) : 'Draft'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

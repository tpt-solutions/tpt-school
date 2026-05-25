import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { NoticeReadTracker } from './notice-read-tracker'

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700',
  event: 'bg-blue-100 text-blue-700',
  urgent: 'bg-red-100 text-red-700',
  academic: 'bg-violet-100 text-violet-700',
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireSession()
  const { id } = await params

  const notice = await db.notice.findUnique({
    where: { id },
    include: { author: { select: { name: true, email: true } } },
  })

  if (!notice) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <NoticeReadTracker noticeId={id} />
      <div>
        <Link
          href="/communication"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Notices
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-3 mb-4">
            {notice.pinned && (
              <div className="flex items-center gap-1 text-amber-600 text-sm font-medium mt-0.5">
                <Pin className="w-4 h-4" />
                Pinned
              </div>
            )}
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                CATEGORY_COLORS[notice.category] ?? 'bg-slate-100 text-slate-700'
              }`}
            >
              {notice.category.charAt(0).toUpperCase() + notice.category.slice(1)}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">{notice.title}</h1>

          <div className="flex items-center gap-3 text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">
            <span>Posted by <strong className="text-slate-700">{notice.author.name}</strong></span>
            <span>&middot;</span>
            <span>{notice.publishedAt ? format(new Date(notice.publishedAt), 'dd MMM yyyy') : 'Draft'}</span>
            {notice.expiresAt && (
              <>
                <span>&middot;</span>
                <span>Expires {format(new Date(notice.expiresAt), 'dd MMM yyyy')}</span>
              </>
            )}
          </div>

          <div className="prose prose-slate max-w-none">
            {notice.body.split('\n').map((line, i) => (
              <p key={i} className="text-slate-700 leading-relaxed mb-3 last:mb-0">
                {line}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

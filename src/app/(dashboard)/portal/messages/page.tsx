import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function PortalMessagesPage() {
  const user = await requireSession()

  // Threads where user is a recipient (received)
  const received = await db.messageRecipient.findMany({
    where: { userId: user.id, message: { parentId: null } },
    include: {
      message: {
        include: {
          sender: { select: { name: true } },
          replies: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { message: { createdAt: 'desc' } },
    take: 50,
  })

  // Threads where user is the sender
  const sent = await db.message.findMany({
    where: { senderId: user.id, parentId: null },
    include: {
      sender: { select: { name: true } },
      recipients: { include: { user: { select: { name: true } } } },
      replies: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Merge + deduplicate by thread id, sorted by latest activity
  type ThreadItem = {
    id: string
    subject: string | null
    senderName: string
    unread: boolean
    latestAt: Date
    replyCount: number
  }

  const threadMap = new Map<string, ThreadItem>()

  for (const mr of received) {
    const m = mr.message
    threadMap.set(m.id, {
      id: m.id,
      subject: m.subject,
      senderName: m.sender.name ?? '',
      unread: !mr.readAt,
      latestAt: m.replies[0]?.createdAt ?? m.createdAt,
      replyCount: m.replies.length,
    })
  }

  for (const m of sent) {
    if (!threadMap.has(m.id)) {
      threadMap.set(m.id, {
        id: m.id,
        subject: m.subject,
        senderName: 'You',
        unread: false,
        latestAt: m.replies[0]?.createdAt ?? m.createdAt,
        replyCount: m.replies.length,
      })
    }
  }

  const threads = Array.from(threadMap.values()).sort(
    (a, b) => b.latestAt.getTime() - a.latestAt.getTime(),
  )

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
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your inbox</p>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No messages yet</p>
          <p className="text-sm mt-1">Messages from staff will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(thread => (
            <Link key={thread.id} href={`/communication/messages/${thread.id}`}>
              <Card
                className={`hover:shadow-md transition-shadow cursor-pointer ${
                  thread.unread ? 'border-primary/30 bg-primary/5' : 'border-slate-100'
                }`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {thread.unread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <p className={`truncate ${thread.unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {thread.subject ?? '(No subject)'}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500">
                        From: {thread.senderName}
                        {thread.replyCount > 0 && (
                          <span className="ml-2 text-xs text-slate-400">
                            {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(thread.latestAt, { addSuffix: true })}
                    </p>
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

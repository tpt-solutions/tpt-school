import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { markMessageReadAction } from '../../actions'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import ReplyForm from './reply-form'

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireSession()
  const { id } = await params

  // Load root message (the thread root may be this id or a parent's id)
  const message = await db.message.findUnique({
    where: { id },
    include: {
      sender: { select: { name: true, email: true } },
      recipients: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  })

  if (!message) notFound()

  // Resolve the thread root id
  const threadId = message.threadId

  // Check access: sender or recipient of the root
  const isRecipient = message.recipients.some(r => r.userId === user.id)
  const isSender = message.senderId === user.id
  if (!isRecipient && !isSender) notFound()

  // Mark as read
  if (isRecipient) {
    await markMessageReadAction(id)
  }

  // Load all replies in the thread
  const replies = await db.message.findMany({
    where: { threadId, parentId: { not: null } },
    include: {
      sender: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Check if the original sender has replies enabled (for non-sender users)
  let repliesAllowed = true
  if (user.id !== message.senderId) {
    const senderStaff = await db.staff.findFirst({ where: { userId: message.senderId } })
    if (senderStaff) {
      repliesAllowed = senderStaff.allowParentReplies
    }
  }

  const backHref = user.role === 'parent' || user.role === 'student'
    ? '/portal/messages'
    : '/communication/messages'

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Messages
        </Link>
      </div>

      {/* Root message */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-4">{message.subject ?? '(No subject)'}</h1>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm text-slate-600 space-y-1">
            <div>
              <span className="font-medium text-slate-700">From:</span>{' '}
              {message.sender.name} &lt;{message.sender.email}&gt;
            </div>
            <div>
              <span className="font-medium text-slate-700">To:</span>{' '}
              {message.recipients.map(r => r.user.name).join(', ')}
            </div>
            <div>
              <span className="font-medium text-slate-700">Date:</span>{' '}
              {format(new Date(message.createdAt), 'dd MMM yyyy, h:mm a')}
            </div>
          </div>

          <div className="text-slate-700 leading-relaxed space-y-3">
            {message.body.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-3 pl-4 border-l-2 border-slate-100">
          {replies.map(reply => (
            <Card key={reply.id} className="border-slate-100">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">{reply.sender.name}</span>
                  <span className="text-xs text-slate-400">
                    {format(new Date(reply.createdAt), 'dd MMM yyyy, h:mm a')}
                  </span>
                </div>
                <div className="text-slate-700 text-sm leading-relaxed space-y-2">
                  {reply.body.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reply form */}
      {repliesAllowed && <ReplyForm threadId={threadId} />}

      {!repliesAllowed && (
        <p className="text-sm text-slate-400 text-center py-2">
          This staff member has disabled replies to their messages.
        </p>
      )}
    </div>
  )
}

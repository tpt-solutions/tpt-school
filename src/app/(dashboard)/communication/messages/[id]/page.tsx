import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { markMessageReadAction } from '../../actions'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireSession()
  const { id } = await params

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

  // Check access: sender or recipient
  const isRecipient = message.recipients.some(r => r.userId === user.id)
  const isSender = message.senderId === user.id
  if (!isRecipient && !isSender) notFound()

  // Mark as read (server action called inline)
  if (isRecipient) {
    await markMessageReadAction(id)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/communication/messages"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Messages
        </Link>
      </div>

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
    </div>
  )
}

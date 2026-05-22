import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function MessagesPage() {
  const user = await requireSession()

  const messages = await db.messageRecipient.findMany({
    where: { userId: user.id },
    include: {
      message: {
        include: { sender: { select: { name: true } } },
      },
    },
    orderBy: { message: { createdAt: 'desc' } },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your inbox</p>
        </div>
        <Link href="/communication/messages/compose">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">Your inbox is empty</p>
          <p className="text-sm mt-1">Messages you receive will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(mr => (
            <Link key={mr.messageId} href={`/communication/messages/${mr.messageId}`}>
              <Card
                className={`hover:shadow-md transition-shadow cursor-pointer ${
                  !mr.readAt ? 'border-primary/30 bg-primary/5' : 'border-slate-100'
                }`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {!mr.readAt && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <p
                          className={`truncate ${
                            !mr.readAt ? 'font-semibold text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {mr.message.subject ?? '(No subject)'}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500">From: {mr.message.sender.name}</p>
                    </div>
                    <p className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(mr.message.createdAt), { addSuffix: true })}
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

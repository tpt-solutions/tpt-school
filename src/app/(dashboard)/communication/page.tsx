import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pin, Plus, Mail, Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700',
  event: 'bg-blue-100 text-blue-700',
  urgent: 'bg-red-100 text-red-700',
  academic: 'bg-violet-100 text-violet-700',
}

function categoryLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

export default async function CommunicationPage() {
  const user = await requireSession()

  const now = new Date()

  // Fetch notices — admin/teacher see all, others see filtered by role
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
    take: 50,
  })

  // Inbox messages
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

  const canPost = user.role === 'admin' || user.role === 'teacher'
  const unreadCount = messages.filter(m => !m.readAt).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Communication</h1>
          <p className="text-sm text-slate-500 mt-0.5">Notices and messages</p>
        </div>
        {canPost && (
          <Link href="/communication/notices/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Post Notice
            </Button>
          </Link>
        )}
      </div>

      <Tabs defaultValue="notices">
        <TabsList>
          <TabsTrigger value="notices" className="gap-2">
            <Bell className="w-4 h-4" />
            Notices
            {notices.length > 0 && (
              <span className="ml-1 text-xs bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5">
                {notices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <Mail className="w-4 h-4" />
            Messages
            {unreadCount > 0 && (
              <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Notices Tab */}
        <TabsContent value="notices" className="mt-4">
          {notices.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No notices to display.</p>
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
                              {categoryLabel(notice.category)}
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
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-4">
          <div className="flex justify-end mb-3">
            <Link href="/communication/messages/compose">
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Compose
              </Button>
            </Link>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Your inbox is empty.</p>
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
                    <CardContent className="py-3 px-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {!mr.readAt && (
                              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                            <p className={`text-sm truncate ${!mr.readAt ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                              {mr.message.subject ?? '(No subject)'}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">From: {mr.message.sender.name}</p>
                        </div>
                        <p className="text-xs text-slate-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(mr.message.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

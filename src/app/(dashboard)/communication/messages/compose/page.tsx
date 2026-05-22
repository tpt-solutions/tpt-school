import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ComposeForm from '../../compose-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function ComposePage() {
  const user = await requireSession()

  // Get all active users except self
  const users = await db.user.findMany({
    where: { active: true, id: { not: user.id } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/communication/messages"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Messages
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Compose Message</h1>
      </div>
      <ComposeForm users={users} />
    </div>
  )
}

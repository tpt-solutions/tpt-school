import { requireRole } from '@/lib/auth'
import NoticeForm from '../../notice-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewNoticePage() {
  await requireRole(['admin', 'teacher'])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/communication"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Communication
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Post Notice</h1>
      </div>
      <NoticeForm />
    </div>
  )
}

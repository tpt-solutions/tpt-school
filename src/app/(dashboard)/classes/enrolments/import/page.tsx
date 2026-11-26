import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import EnrolmentsImportClient from './enrolments-import-client'

export default async function EnrolmentsImportPage() {
  await requireRole(['admin'])
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/classes" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Classes
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Import Enrolments</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload a CSV file to enrol students in classes in bulk.</p>
      </div>
      <EnrolmentsImportClient />
    </div>
  )
}

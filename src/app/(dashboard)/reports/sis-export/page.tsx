import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft, Download, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SisDownloadButtons from './sis-download-buttons'

export default async function SisExportPage() {
  await requireRole(['admin'])

  const studentCount = await db.student.count()
  const nsnCount = await db.student.count({ where: { nsn: { not: null } } })
  const attendanceCount = await db.attendance.count()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">SIS Data Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export student and attendance data for import into external school information systems.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="secondary">{studentCount} students</Badge>
        <Badge variant="secondary">{attendanceCount.toLocaleString()} attendance records</Badge>
        {nsnCount < studentCount && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {studentCount - nsnCount} students missing NSN
          </Badge>
        )}
      </div>

      {/* NSN info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          The <strong>NSN field</strong> on each student record maps to the national student identifier for your region:
          NZ NSN, UK UPN, AU State Student ID, or CA OEN/PEN. Edit it on the student profile page.
        </span>
      </div>

      <div className="space-y-6">
        {/* Universal formats */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Universal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExportCard
              title="Students CSV"
              description="All student records in a generic comma-separated format compatible with any SIS."
              format="CSV"
              href="/api/export/sis/students"
              filename="students.csv"
            />
            <Card className="border-slate-100">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-slate-900">Attendance CSV</CardTitle>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 shrink-0">CSV</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 mb-3">Full attendance history in universal CSV format. Use the date range filter at the bottom of this page to export a specific period.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Region-specific formats */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">New Zealand</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExportCard
              title="NZ MoE Students CSV"
              description="New Zealand Ministry of Education format with ethnicity codes (1–9) and NSN."
              format="CSV"
              href="/api/export/sis/nz-moe"
              filename="nz-moe-students.csv"
              region="NZ"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">United Kingdom</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExportCard
              title="UK SIMS Students CSV"
              description="Format for Capita SIMS school MIS. Includes UPN, dd/mm/yyyy dates, gender initial."
              format="CSV"
              href="/api/export/sis/uk-sims"
              filename="uk-sims-students.csv"
              region="UK"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Australia</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExportCard
              title="AU Synergetic Students CSV"
              description="Synergetic SIS format with LBOTE flag, Indigenous Status codes, and State Student ID."
              format="CSV"
              href="/api/export/sis/au-synergetic"
              filename="au-synergetic-students.csv"
              region="AU"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Canada</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExportCard
              title="CA PowerSchool Students CSV"
              description="PowerSchool SIS format used across Canadian provinces. Includes OEN/PEN and MM/DD/YYYY dates."
              format="CSV"
              href="/api/export/sis/ca-powerschool"
              filename="ca-powerschool-students.csv"
              region="CA"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">US / International</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExportCard
              title="Ed-Fi JSON Export"
              description="Ed-Fi data standard JSON including students, enrollments, and attendance events. Used by US districts and international systems."
              format="JSON"
              href="/api/export/sis/ed-fi"
              filename="edfi-export.json"
              region="US"
            />
          </div>
        </div>
      </div>

      <SisDownloadButtons />
    </div>
  )
}

function ExportCard({
  title,
  description,
  format,
  href,
  filename,
  region,
}: {
  title: string
  description: string
  format: 'CSV' | 'JSON'
  href: string
  filename: string
  region?: string
}) {
  return (
    <Card className="border-slate-100">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
          <div className="flex gap-1.5 shrink-0">
            {region && <Badge variant="secondary" className="text-xs">{region}</Badge>}
            <Badge
              variant="outline"
              className={format === 'JSON' ? 'text-violet-600 border-violet-200' : 'text-emerald-600 border-emerald-200'}
            >
              {format}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500 mb-4">{description}</p>
        <a
          href={href}
          download={filename}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download {filename}
        </a>
      </CardContent>
    </Card>
  )
}

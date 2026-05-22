import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import IncidentDetailClient from './incident-detail-client'

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-800',
  moderate: 'bg-orange-100 text-orange-800',
  major: 'bg-red-100 text-red-800',
  critical: 'bg-red-700 text-white',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const session = await requireRole(['admin', 'teacher'])
  const { id } = await params

  const incident = await db.behaviourIncident.findUnique({
    where: { id },
    include: {
      student: { include: { user: true } },
      suspensions: { orderBy: { startDate: 'desc' } },
    },
  })

  if (!incident) notFound()

  const reporter = await db.user.findUnique({
    where: { id: incident.reportedById },
    select: { name: true },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + header */}
      <div>
        <Link
          href="/behaviour"
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' mb-3 -ml-1 text-slate-500'}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Behaviour
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Behaviour Incident</h1>
            <p className="text-slate-500 mt-1">
              {incident.student.user.name} · {format(new Date(incident.date), 'dd MMM yyyy')}
            </p>
          </div>
          <span className={`text-sm font-medium px-3 py-1.5 rounded-full capitalize ${SEVERITY_COLORS[incident.severity] ?? 'bg-slate-100 text-slate-600'}`}>
            {incident.severity}
          </span>
        </div>
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incident Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Student</p>
              <Link href={`/students/${incident.studentId}`} className="font-medium text-slate-900 hover:text-primary">
                {incident.student.user.name}
              </Link>
              <p className="text-xs text-slate-400">{incident.student.studentId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Reported by</p>
              <p className="font-medium text-slate-900">{reporter?.name ?? 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Location</p>
              <p className="text-slate-700 capitalize">{incident.location ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Parent notified</p>
              <p className="text-slate-700">
                {incident.parentNotified
                  ? incident.parentNotifiedAt
                    ? format(new Date(incident.parentNotifiedAt), 'dd MMM yyyy')
                    : 'Yes'
                  : 'No'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Description</p>
            <p className="text-slate-800 whitespace-pre-line">{incident.description}</p>
          </div>

          {incident.witnesses && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Witnesses</p>
              <p className="text-slate-700">{incident.witnesses}</p>
            </div>
          )}

          {incident.actionTaken && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Action taken</p>
              <p className="text-slate-700">{incident.actionTaken}</p>
            </div>
          )}

          {incident.followUpRequired && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 mb-1">Follow-up required</p>
              {incident.followUpNotes && (
                <p className="text-sm text-amber-700">{incident.followUpNotes}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspensions linked to this incident */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Suspensions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {incident.suspensions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No suspensions linked to this incident.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">End</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Days</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incident.suspensions.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 capitalize text-slate-700">{s.type.replace('-', ' ')}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(s.startDate), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(s.endDate), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-slate-600">{s.totalDays}</td>
                    <td className="px-4 py-3">
                      {s.returnDate ? (
                        <Badge variant="secondary">Returned</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-0">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Client component: edit form + add suspension form */}
      <IncidentDetailClient
        incident={{
          id: incident.id,
          studentId: incident.studentId,
          description: incident.description,
          location: incident.location,
          severity: incident.severity,
          witnesses: incident.witnesses,
          actionTaken: incident.actionTaken,
          parentNotified: incident.parentNotified,
          followUpRequired: incident.followUpRequired,
          followUpNotes: incident.followUpNotes,
        }}
        canSuspend={session.role === 'admin'}
      />
    </div>
  )
}

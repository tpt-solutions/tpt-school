import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ChevronLeft, Pencil, User, CalendarDays } from 'lucide-react'
import { LeaveApproveButton, LeaveDeclineButton } from './leave-actions'
import LeaveRequestForm from './leave-request-form'

type Params = Promise<{ id: string }>

const LEAVE_STATUS_STYLE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:  { label: 'Pending',  variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:       'Annual Leave',
  sick:         'Sick Leave',
  personal:     'Personal Leave',
  bereavement:  'Bereavement Leave',
  unpaid:       'Unpaid Leave',
  other:        'Other',
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value || <span className="text-slate-400 font-normal">—</span>}</dd>
    </div>
  )
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export default async function StaffDetailPage({ params }: { params: Params }) {
  const session = await requireRole(['admin'])
  const { id } = await params

  const staff = await db.staff.findUnique({
    where: { id },
    include: {
      user: true,
      leaveRequests: {
        orderBy: { createdAt: 'desc' },
      },
      classes: {
        include: { class: true },
      },
    },
  })

  if (!staff) notFound()

  const isActive = !staff.dateLeft

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/staff"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Staff
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xl shrink-0">
              {staff.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{staff.user.name}</h1>
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {isActive ? 'Active' : 'Left'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {staff.employeeId}
                {staff.jobTitle ? ` · ${staff.jobTitle}` : ''}
                {staff.department ? ` · ${staff.department}` : ''}
              </p>
            </div>
          </div>

          <Link href={`/staff/${id}/edit`} className={buttonVariants({ variant: 'outline' })}>
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="leave">
            <CalendarDays className="w-4 h-4" />
            Leave Requests
            {staff.leaveRequests.filter((l) => l.status === 'pending').length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {staff.leaveRequests.filter((l) => l.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Personal</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Full Name" value={staff.user.name} />
                  <DetailRow label="Email" value={staff.user.email} />
                  <DetailRow label="Phone" value={staff.user.phone} />
                </dl>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Employment</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Employee ID" value={staff.employeeId} />
                  <DetailRow label="Job Title" value={staff.jobTitle} />
                  <DetailRow label="Department" value={staff.department} />
                  <DetailRow
                    label="Employment Type"
                    value={
                      staff.employmentType === 'full-time' ? 'Full-time'
                        : staff.employmentType === 'part-time' ? 'Part-time'
                        : 'Casual'
                    }
                  />
                  <DetailRow
                    label="Date Hired"
                    value={
                      staff.dateHired
                        ? new Date(staff.dateHired).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
                        : null
                    }
                  />
                  {staff.dateLeft && (
                    <DetailRow
                      label="Date Left"
                      value={new Date(staff.dateLeft).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                    />
                  )}
                </dl>
              </CardContent>
            </Card>

            {staff.qualifications && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Qualifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{staff.qualifications}</p>
                </CardContent>
              </Card>
            )}

            {staff.bio && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{staff.bio}</p>
                </CardContent>
              </Card>
            )}

            {staff.classes.length > 0 && (
              <Card className="border-slate-200 shadow-sm lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Assigned Classes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {staff.classes.map(({ class: cls, isPrimary }) => (
                      <div
                        key={cls.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium text-slate-800">{cls.name}</span>
                        <span className="text-slate-400 font-mono text-xs">{cls.code}</span>
                        {isPrimary && <Badge variant="secondary" className="text-[10px] h-4">Primary</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Leave Requests Tab */}
        <TabsContent value="leave" className="mt-4">
          <div className="space-y-6">
            {/* Submit new request */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-slate-800">Submit Leave Request</CardTitle>
              </CardHeader>
              <CardContent>
                <LeaveRequestForm staffId={id} />
              </CardContent>
            </Card>

            {/* Existing requests */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Leave History ({staff.leaveRequests.length})
              </h3>
              {staff.leaveRequests.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
                  No leave requests have been submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {staff.leaveRequests.map((leave) => {
                    const statusInfo = LEAVE_STATUS_STYLE[leave.status] ?? { label: leave.status, variant: 'outline' as const }
                    const days = daysBetween(leave.startDate, leave.endDate)
                    return (
                      <Card key={leave.id} className="border-slate-200 shadow-sm">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-800">
                                  {LEAVE_TYPE_LABELS[leave.type] ?? leave.type}
                                </span>
                                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                              </div>
                              <p className="text-sm text-slate-500">
                                {new Date(leave.startDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' — '}
                                {new Date(leave.endDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' · '}
                                <span className="font-medium">{days} day{days !== 1 ? 's' : ''}</span>
                              </p>
                              {leave.reason && (
                                <p className="text-sm text-slate-600 mt-1">{leave.reason}</p>
                              )}
                              {leave.approvedBy && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {leave.status === 'approved' ? 'Approved' : 'Declined'} by {leave.approvedBy}
                                </p>
                              )}
                              <p className="text-xs text-slate-400">
                                Submitted {new Date(leave.createdAt).toLocaleDateString('en-NZ')}
                              </p>
                            </div>

                            {/* Admin approve/decline buttons for pending requests */}
                            {leave.status === 'pending' && (
                              <div className="flex items-center gap-2 shrink-0">
                                <LeaveApproveButton leaveId={leave.id} approverName={session.name} />
                                <LeaveDeclineButton leaveId={leave.id} approverName={session.name} />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

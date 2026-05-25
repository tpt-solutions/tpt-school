'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Clock, XCircle, ListOrdered, BookOpen, Users, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  submitEnrolmentRequestAction,
  submitParentEnrolmentRequestAction,
  cancelEnrolmentRequestAction,
  joinWaitlistAction,
} from './actions'

type ClassItem = {
  id: string
  name: string
  code: string
  subject: string | null
  yearLevel: number | null
  maxStudents: number | null
  enrolledCount: number
  primaryTeacher: string | null
  status: 'enrolled' | 'pending' | 'rejected' | 'waitlisted' | null
}

type Props = {
  classes: ClassItem[]
  studentId: string | null
  userRole: string
  childrenOptions: { id: string; name: string; yearLevel: number | null }[]
}

function StatusBadge({ status }: { status: ClassItem['status'] }) {
  if (!status) return null
  const config = {
    enrolled: { label: 'Enrolled', icon: CheckCircle2, className: 'text-green-700 bg-green-50 border-green-200' },
    pending: { label: 'Request Pending', icon: Clock, className: 'text-amber-700 bg-amber-50 border-amber-200' },
    rejected: { label: 'Request Rejected', icon: XCircle, className: 'text-red-700 bg-red-50 border-red-200' },
    waitlisted: { label: 'On Waitlist', icon: ListOrdered, className: 'text-blue-700 bg-blue-50 border-blue-200' },
  }[status]
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', config.className)}>
      <Icon className="h-3 w-3" /> {config.label}
    </span>
  )
}

function ClassCard({
  cls,
  studentId,
  userRole,
  selectedChildId,
}: {
  cls: ClassItem
  studentId: string | null
  userRole: string
  selectedChildId: string | null
}) {
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [localStatus, setLocalStatus] = useState(cls.status)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const isFull = cls.maxStudents !== null && cls.enrolledCount >= cls.maxStudents
  const effectiveStudentId = userRole === 'parent' ? selectedChildId : studentId

  function handleRequest() {
    if (!effectiveStudentId) { setFeedback({ type: 'error', text: 'Please select a student first.' }); return }
    setFeedback(null)
    startTransition(async () => {
      const result = userRole === 'parent'
        ? await submitParentEnrolmentRequestAction(cls.id, effectiveStudentId, message)
        : await submitEnrolmentRequestAction(cls.id, message)
      if (result.error) {
        setFeedback({ type: 'error', text: result.error })
      } else {
        setLocalStatus('pending')
        setShowForm(false)
        setMessage('')
        setFeedback({ type: 'success', text: 'Request submitted! Staff will review your application.' })
      }
    })
  }

  function handleCancel() {
    if (!effectiveStudentId) return
    setFeedback(null)
    startTransition(async () => {
      const result = await cancelEnrolmentRequestAction(cls.id)
      if (result.error) setFeedback({ type: 'error', text: result.error })
      else { setLocalStatus(null); setFeedback(null) }
    })
  }

  function handleWaitlist() {
    if (!effectiveStudentId) return
    setFeedback(null)
    startTransition(async () => {
      const result = await joinWaitlistAction(cls.id)
      if (result.error) setFeedback({ type: 'error', text: result.error })
      else { setLocalStatus('waitlisted'); setFeedback({ type: 'success', text: 'Added to waitlist.' }) }
    })
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{cls.name}</span>
              <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">{cls.code}</span>
              {cls.yearLevel && <Badge variant="secondary" className="text-xs">Year {cls.yearLevel}</Badge>}
              <StatusBadge status={localStatus} />
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              {cls.subject && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {cls.subject}</span>}
              {cls.primaryTeacher && <span>{cls.primaryTeacher}</span>}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {cls.enrolledCount}{cls.maxStudents ? `/${cls.maxStudents}` : ''} students
                {isFull && <span className="text-amber-600 font-medium ml-1">· Class full</span>}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {localStatus === null && !isFull && (
              <Button size="sm" onClick={() => setShowForm((s) => !s)} disabled={!effectiveStudentId}>
                Request Enrollment
              </Button>
            )}
            {localStatus === null && isFull && (
              <Button size="sm" variant="outline" onClick={handleWaitlist} disabled={isPending || !effectiveStudentId}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Join Waitlist
              </Button>
            )}
            {localStatus === 'pending' && (
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Cancel Request
              </Button>
            )}
          </div>
        </div>

        {showForm && localStatus === null && (
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message to the school (e.g. reason for enrollment, special requirements)…"
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRequest} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Submit Request
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setMessage('') }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {feedback && (
          <p className={cn('mt-2 text-xs', feedback.type === 'error' ? 'text-destructive' : 'text-green-700')}>
            {feedback.text}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function EnrollClassList({ classes, studentId, userRole, childrenOptions }: Props) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    childrenOptions.length === 1 ? childrenOptions[0].id : null,
  )

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
        No classes are available for enrollment at this time.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {userRole === 'parent' && childrenOptions.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Enrolling for:</label>
          <select
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm shadow-sm"
            value={selectedChildId ?? ''}
            onChange={(e) => setSelectedChildId(e.target.value || null)}
          >
            <option value="">Select a child…</option>
            {childrenOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.yearLevel ? ` (Year ${c.yearLevel})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {classes.map((cls) => (
          <ClassCard
            key={cls.id}
            cls={cls}
            studentId={studentId}
            userRole={userRole}
            selectedChildId={selectedChildId}
          />
        ))}
      </div>
    </div>
  )
}

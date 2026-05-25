'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, Users, Loader2, ClipboardList } from 'lucide-react'
import { approveEnrolmentRequestAction, rejectEnrolmentRequestAction } from '../classes/actions'

type RequestItem = {
  id: string
  message: string | null
  createdAt: Date
  class: { id: string; name: string; code: string; maxStudents: number | null; enrolledCount: number }
  student: { name: string; email: string }
  requestedBy: { name: string; role: string }
}

function RequestCard({ request }: { request: RequestItem }) {
  const [done, setDone] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isFull =
    request.class.maxStudents !== null && request.class.enrolledCount >= request.class.maxStudents

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveEnrolmentRequestAction(request.id)
      if (result.error) setError(result.error)
      else setDone(true)
    })
  }

  function handleReject() {
    setError(null)
    startTransition(async () => {
      const result = await rejectEnrolmentRequestAction(request.id, reason)
      if (result.error) setError(result.error)
      else setDone(true)
    })
  }

  if (done) return null

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{request.student.name}</span>
              <span className="text-xs text-slate-500">→</span>
              <span className="font-medium text-slate-700">{request.class.name}</span>
              <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                {request.class.code}
              </span>
              {isFull && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                  Class Full
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {request.class.enrolledCount}{request.class.maxStudents ? `/${request.class.maxStudents}` : ''} enrolled
              </span>
              <span>
                Requested by {request.requestedBy.name}
                {request.requestedBy.role === 'parent' ? ' (parent)' : ''}
              </span>
              <span>{new Date(request.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            {request.message && (
              <p className="text-xs text-slate-600 italic mt-1">"{request.message}"</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isPending}
              className="text-xs"
            >
              {isPending && !showReject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReject((s) => !s)}
              disabled={isPending}
              className="text-xs"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>

        {showReject && (
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setReason('') }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </CardContent>
    </Card>
  )
}

export default function EnrolmentRequestsList({ requests }: { requests: RequestItem[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No pending enrollment requests.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </div>
  )
}

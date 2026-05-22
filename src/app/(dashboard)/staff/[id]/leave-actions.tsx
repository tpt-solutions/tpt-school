'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateLeaveStatusAction } from '../actions'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

type Props = {
  leaveId: string
  approverName: string
}

export function LeaveApproveButton({ leaveId, approverName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Approved
      </span>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await updateLeaveStatusAction(leaveId, 'approved', approverName)
          if (result.success) setDone(true)
        })
      }}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
      Approve
    </Button>
  )
}

export function LeaveDeclineButton({ leaveId, approverName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
        <XCircle className="w-3.5 h-3.5" />
        Declined
      </span>
    )
  }

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await updateLeaveStatusAction(leaveId, 'declined', approverName)
          if (result.success) setDone(true)
        })
      }}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
      Decline
    </Button>
  )
}

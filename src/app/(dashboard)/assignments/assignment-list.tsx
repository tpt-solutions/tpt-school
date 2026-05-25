'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  Upload,
  X,
  Loader2,
  Award,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { submitAssignmentAction, unsubmitAssignmentAction } from './actions'

type Assignment = {
  id: string
  name: string
  description: string | null
  type: string
  maxScore: number
  dueDate: Date | null
  documentUrl: string | null
  className: string
  termName: string
  score: number | null
  gradeLabel: string | null
  comment: string | null
  submittedAt: Date | null
  submissionUrl: string | null
  gradedAt: Date | null
}

type Props = {
  assignments: Assignment[]
  studentId: string | null
  userRole: string
  childOptions: { id: string; name: string }[]
  isParent: boolean
}

function statusOf(a: Assignment) {
  if (a.gradedAt) return 'graded'
  if (a.submittedAt) return 'submitted'
  if (a.dueDate && new Date(a.dueDate) < new Date()) return 'overdue'
  return 'pending'
}

const STATUS_CONFIG = {
  graded: { label: 'Graded', className: 'bg-green-50 text-green-700 border-green-200', icon: Award },
  submitted: { label: 'Submitted', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200', icon: Clock },
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
}

function fmt(d: Date | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AssignmentCard({ a, isParent }: { a: Assignment; isParent: boolean }) {
  const status = statusOf(a)
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  const [showSubmit, setShowSubmit] = useState(false)
  const [url, setUrl] = useState(a.submissionUrl ?? '')
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState(status)
  const [localSubmittedAt, setLocalSubmittedAt] = useState(a.submittedAt)
  const [localUrl, setLocalUrl] = useState(a.submissionUrl)
  const [error, setError] = useState<string | null>(null)

  const currentCfg = STATUS_CONFIG[localStatus as keyof typeof STATUS_CONFIG] ?? cfg
  const CurrentIcon = currentCfg.icon

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitAssignmentAction(a.id, url || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        setLocalStatus('submitted')
        setLocalSubmittedAt(new Date())
        setLocalUrl(url || null)
        setShowSubmit(false)
      }
    })
  }

  function handleUnsubmit() {
    setError(null)
    startTransition(async () => {
      const result = await unsubmitAssignmentAction(a.id)
      if (result.error) {
        setError(result.error)
      } else {
        setLocalStatus(a.dueDate && new Date(a.dueDate) < new Date() ? 'overdue' : 'pending')
        setLocalSubmittedAt(null)
        setLocalUrl(null)
        setUrl('')
      }
    })
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{a.name}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
                  currentCfg.className,
                )}
              >
                <CurrentIcon className="h-3 w-3" />
                {currentCfg.label}
              </span>
              <Badge variant="secondary" className="text-xs">{a.type}</Badge>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{a.className}</span>
              <span>·</span>
              <span>{a.termName}</span>
              {a.dueDate && (
                <>
                  <span>·</span>
                  <span className={cn(localStatus === 'overdue' && 'text-red-600 font-medium')}>
                    Due {fmt(a.dueDate)}
                  </span>
                </>
              )}
              {a.documentUrl && (
                <a
                  href={a.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary flex items-center gap-0.5 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View Assignment
                </a>
              )}
            </div>

            {a.description && (
              <p className="text-xs text-slate-500 mt-1">{a.description}</p>
            )}

            {/* Submission info */}
            {localSubmittedAt && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-blue-600">
                  Submitted {fmt(localSubmittedAt)}
                </span>
                {localUrl && (
                  <a
                    href={localUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> My submission
                  </a>
                )}
              </div>
            )}

            {/* Grade result */}
            {a.gradedAt && (
              <div className="mt-2 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-sm">
                <Award className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-700">
                  {a.score !== null ? `${a.score}/${a.maxScore}` : '—'}
                  {a.gradeLabel ? ` (${a.gradeLabel})` : ''}
                </span>
                {a.comment && (
                  <span className="text-green-600 text-xs">· {a.comment}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions — students only */}
          {!isParent && (
            <div className="flex flex-col gap-2 shrink-0">
              {localStatus === 'pending' || localStatus === 'overdue' ? (
                <Button size="sm" onClick={() => setShowSubmit((s) => !s)}>
                  <Upload className="h-3.5 w-3.5" />
                  Submit
                </Button>
              ) : localStatus === 'submitted' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnsubmit}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Withdraw
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Submission form */}
        {showSubmit && !isParent && (
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Document URL (optional)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Google Doc, OneDrive, or any link…"
                className="text-sm"
              />
              <p className="text-xs text-slate-400">
                Paste a shareable link to your work — Google Doc, OneDrive file, or any URL.
                Leave blank to submit without a document.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirm Submit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowSubmit(false); setUrl(a.submissionUrl ?? '') }}
              >
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

export default function AssignmentList({ assignments, studentId, userRole, childOptions, isParent }: Props) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    childOptions.length === 1 ? childOptions[0].id : null,
  )

  // Group by status for display
  const sorted = [...assignments].sort((a, b) => {
    const order = { graded: 3, submitted: 1, overdue: 0, pending: 2 }
    return (order[statusOf(a) as keyof typeof order] ?? 2) - (order[statusOf(b) as keyof typeof order] ?? 2)
  })

  const pending = sorted.filter((a) => statusOf(a) === 'pending' || statusOf(a) === 'overdue')
  const submitted = sorted.filter((a) => statusOf(a) === 'submitted')
  const graded = sorted.filter((a) => statusOf(a) === 'graded')

  if (!studentId && childOptions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
        No student profile linked to this account.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isParent && childOptions.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Viewing assignments for:</label>
          <select
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm shadow-sm"
            value={selectedChildId ?? ''}
            onChange={(e) => setSelectedChildId(e.target.value || null)}
          >
            <option value="">Select a child…</option>
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
          No assignments found. Once your teacher creates assessments for your classes, they will appear here.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                To Do ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((a) => <AssignmentCard key={a.id} a={a} isParent={isParent} />)}
              </div>
            </section>
          )}

          {submitted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Awaiting Marking ({submitted.length})
              </h2>
              <div className="space-y-3">
                {submitted.map((a) => <AssignmentCard key={a.id} a={a} isParent={isParent} />)}
              </div>
            </section>
          )}

          {graded.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Marked ({graded.length})
              </h2>
              <div className="space-y-3">
                {graded.map((a) => <AssignmentCard key={a.id} a={a} isParent={isParent} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { recordTransferInAction, getSuggestedClassesAction } from '../actions'
import { enrollStudentAction } from '../../classes/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

type SuggestedClass = {
  id: string
  name: string
  subject: string
  teacherName: string | null
  roomCode: string | null
  enrolled: number
  maxStudents: number | null
}

type TransferIn = {
  previousSchool: string
  previousYearLevel: number | null
  transferDate: Date
  reason: string | null
  documentsReceived: boolean
  academicRecordsNotes: string | null
  notes: string | null
}

type Props = {
  studentId: string
  canEdit: boolean
  transferIn: TransferIn | null
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 sm:w-48 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value || <span className="text-slate-400 font-normal">—</span>}</dd>
    </div>
  )
}

export default function TransferInPanel({ studentId, canEdit, transferIn }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedClass[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const loadSuggestions = useCallback(async () => {
    if (!canEdit) return
    setLoadingSuggestions(true)
    const result = await getSuggestedClassesAction(studentId)
    setSuggestions(result)
    setLoadingSuggestions(false)
  }, [studentId, canEdit])

  useEffect(() => {
    loadSuggestions()
  }, [loadSuggestions])

  async function handleEnroll(classId: string) {
    setEnrollingId(classId)
    setEnrollError(null)
    const result = await enrollStudentAction(classId, studentId)
    if (result.error) {
      setEnrollError(result.error)
    } else {
      await loadSuggestions()
    }
    setEnrollingId(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await recordTransferInAction(studentId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Transfer record saved.')
        setEditing(false)
      }
    })
  }

  if (!transferIn && !editing) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-4">
          <p className="text-slate-400">No transfer-in record for this student.</p>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing(true)}>Record Transfer In</Button>
          )}
        </div>
        {canEdit && <SuggestedClassesSection suggestions={suggestions} loading={loadingSuggestions} enrollingId={enrollingId} enrollError={enrollError} onEnroll={handleEnroll} />}
      </div>
    )
  }

  if (editing) {
    return (
      <Card className="max-w-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{transferIn ? 'Edit Transfer-In Record' : 'Record Transfer In'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="previousSchool">Previous School *</Label>
              <Input
                id="previousSchool"
                name="previousSchool"
                defaultValue={transferIn?.previousSchool ?? ''}
                placeholder="Name of previous school"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="transferDate">Transfer Date *</Label>
                <Input
                  id="transferDate"
                  name="transferDate"
                  type="date"
                  defaultValue={
                    transferIn
                      ? format(new Date(transferIn.transferDate), 'yyyy-MM-dd')
                      : todayStr
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="previousYearLevel">Previous Year Level</Label>
                <Input
                  id="previousYearLevel"
                  name="previousYearLevel"
                  type="number"
                  min="1"
                  max="13"
                  defaultValue={transferIn?.previousYearLevel ?? ''}
                  placeholder="e.g. 9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason for transfer</Label>
              <Input
                id="reason"
                name="reason"
                defaultValue={transferIn?.reason ?? ''}
                placeholder="e.g. Family relocation"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="academicRecordsNotes">Academic records notes</Label>
              <Textarea
                id="academicRecordsNotes"
                name="academicRecordsNotes"
                rows={2}
                defaultValue={transferIn?.academicRecordsNotes ?? ''}
                placeholder="Notes on academic records received from previous school..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Additional notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={transferIn?.notes ?? ''}
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="documentsReceived"
                defaultChecked={transferIn?.documentsReceived ?? false}
                className="h-4 w-4 rounded border-slate-300"
              />
              Documents received from previous school
            </label>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Record'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  // View mode
  return (
    <div className="space-y-6">
    <Card className="max-w-xl border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Transfer-In Record</CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => { setEditing(true); setSuccessMsg(null) }}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {successMsg && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4">
            {successMsg}
          </div>
        )}
        <dl>
          <DetailRow label="Previous School" value={transferIn!.previousSchool} />
          <DetailRow
            label="Transfer Date"
            value={format(new Date(transferIn!.transferDate), 'dd MMMM yyyy')}
          />
          <DetailRow
            label="Previous Year Level"
            value={transferIn!.previousYearLevel ? `Year ${transferIn!.previousYearLevel}` : null}
          />
          <DetailRow label="Reason" value={transferIn!.reason} />
          <DetailRow
            label="Documents received"
            value={transferIn!.documentsReceived ? 'Yes' : 'No'}
          />
          <DetailRow label="Academic records notes" value={transferIn!.academicRecordsNotes} />
          <DetailRow label="Notes" value={transferIn!.notes} />
        </dl>
      </CardContent>
    </Card>
    {canEdit && <SuggestedClassesSection suggestions={suggestions} loading={loadingSuggestions} enrollingId={enrollingId} enrollError={enrollError} onEnroll={handleEnroll} />}
    </div>
  )
}

function SuggestedClassesSection({
  suggestions,
  loading,
  enrollingId,
  enrollError,
  onEnroll,
}: {
  suggestions: SuggestedClass[]
  loading: boolean
  enrollingId: string | null
  enrollError: string | null
  onEnroll: (classId: string) => void
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Suggested Classes</CardTitle>
        <p className="text-sm text-slate-500">Classes at this student&apos;s year level with available capacity.</p>
      </CardHeader>
      <CardContent>
        {enrollError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{enrollError}</div>
        )}
        {loading ? (
          <p className="text-sm text-slate-400">Loading suggestions...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-slate-400">No classes with available capacity at this student&apos;s year level.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Class</th>
                  <th className="pb-2 pr-4 font-medium">Subject</th>
                  <th className="pb-2 pr-4 font-medium">Teacher</th>
                  <th className="pb-2 pr-4 font-medium">Room</th>
                  <th className="pb-2 pr-4 font-medium">Spots</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(cls => (
                  <tr key={cls.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{cls.name}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{cls.subject || '—'}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{cls.teacherName ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{cls.roomCode ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {cls.maxStudents !== null ? `${cls.enrolled} / ${cls.maxStudents}` : cls.enrolled}
                    </td>
                    <td className="py-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={enrollingId === cls.id}
                        onClick={() => onEnroll(cls.id)}
                      >
                        {enrollingId === cls.id ? 'Enrolling...' : 'Enroll'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

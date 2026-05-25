'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveAttendanceAction } from '../../actions'
import { enqueue, getPending, dequeue } from '@/lib/attendance-queue'
import { CheckCircle2, XCircle, Clock, BookOpen, WifiOff, RefreshCw } from 'lucide-react'

type StudentRecord = {
  studentId: string
  name: string
  studentCode: string
  existingStatus?: string
  existingNotes?: string
}

interface RollFormProps {
  classId: string
  students: StudentRecord[]
  termId: string
  markedById: string
}

type StatusValue = 'present' | 'absent' | 'late' | 'excused'

const STATUS_OPTIONS: { value: StatusValue; label: string; color: string; activeColor: string }[] = [
  { value: 'present', label: 'Present', color: 'border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700', activeColor: 'border-green-500 bg-green-50 text-green-700' },
  { value: 'absent', label: 'Absent', color: 'border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-700', activeColor: 'border-red-500 bg-red-50 text-red-700' },
  { value: 'late', label: 'Late', color: 'border-slate-200 text-slate-600 hover:border-yellow-300 hover:text-yellow-700', activeColor: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
  { value: 'excused', label: 'Excused', color: 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700', activeColor: 'border-blue-500 bg-blue-50 text-blue-700' },
]

export default function RollForm({ classId, students, termId, markedById }: RollFormProps) {
  const [statuses, setStatuses] = useState<Record<string, StatusValue>>(
    Object.fromEntries(
      students.map((s) => [s.studentId, (s.existingStatus as StatusValue) ?? 'present'])
    )
  )
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(
      students.map((s) => [s.studentId, s.existingNotes ?? ''])
    )
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  // Load initial pending count
  useEffect(() => {
    getPending().then(p => setPendingCount(p.length))
  }, [])

  const flushQueue = useCallback(async () => {
    const pending = await getPending()
    if (pending.length === 0) return
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      })
      if (res.ok) {
        const data: { savedIds: string[] } = await res.json()
        await Promise.all(data.savedIds.map(dequeue))
        const remaining = await getPending()
        setPendingCount(remaining.length)
      }
    } finally {
      setSyncing(false)
    }
  }, [])

  // Online/offline listeners + auto-flush on reconnect
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); flushQueue() }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [flushQueue])

  function setAll(status: StatusValue) {
    setStatuses(Object.fromEntries(students.map((s) => [s.studentId, status])))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    setSavedOffline(false)

    const records = students.map((s) => ({
      studentId: s.studentId,
      status: statuses[s.studentId] ?? 'present',
      notes: notes[s.studentId] || undefined,
    }))

    if (!isOnline) {
      // Queue for later sync
      const queued = records.map(r => ({
        id: crypto.randomUUID(),
        studentId: r.studentId,
        classId,
        termId,
        date: new Date().toISOString(),
        status: r.status,
        notes: r.notes,
        markedById,
        queuedAt: Date.now(),
      }))
      await Promise.all(queued.map(enqueue))
      const pending = await getPending()
      setPendingCount(pending.length)
      setSavedOffline(true)
      setSaved(true)
      setSaving(false)
      setTimeout(() => setSaved(false), 4000)
      return
    }

    const result = await saveAttendanceAction(classId, records)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const summary = {
    present: Object.values(statuses).filter((s) => s === 'present').length,
    absent: Object.values(statuses).filter((s) => s === 'absent').length,
    late: Object.values(statuses).filter((s) => s === 'late').length,
    excused: Object.values(statuses).filter((s) => s === 'excused').length,
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No students enrolled in this class</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          You are offline. Attendance will be saved to this device and synced automatically when you reconnect.
        </div>
      )}

      {/* Pending sync banner */}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
          {syncing
            ? `Syncing ${pendingCount} queued record(s)…`
            : `${pendingCount} queued record(s) pending sync.`}
          {!syncing && (
            <button type="button" onClick={flushQueue} className="underline ml-1 font-medium">
              Sync now
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {savedOffline
            ? 'Saved locally — will sync when you reconnect.'
            : 'Attendance saved successfully'}
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 bg-slate-50 rounded-xl p-4 items-center">
        <span className="text-sm font-medium text-slate-600 mr-2">Summary:</span>
        <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="w-4 h-4" />{summary.present} Present</span>
        <span className="flex items-center gap-1.5 text-sm text-red-600"><XCircle className="w-4 h-4" />{summary.absent} Absent</span>
        <span className="flex items-center gap-1.5 text-sm text-yellow-600"><Clock className="w-4 h-4" />{summary.late} Late</span>
        <span className="flex items-center gap-1.5 text-sm text-blue-600"><BookOpen className="w-4 h-4" />{summary.excused} Excused</span>

        <div className="ml-auto flex gap-2">
          <span className="text-xs text-slate-500 self-center">Mark all:</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setAll('present')} className="text-green-700 border-green-200 hover:bg-green-50">Present</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAll('absent')} className="text-red-600 border-red-200 hover:bg-red-50">Absent</Button>
        </div>
      </div>

      {/* Student rows */}
      <div className="space-y-2">
        {students.map((student, idx) => {
          const currentStatus = statuses[student.studentId] ?? 'present'
          return (
            <div
              key={student.studentId}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500 flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{student.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{student.studentCode}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatuses({ ...statuses, [student.studentId]: opt.value })}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        currentStatus === opt.value ? opt.activeColor : opt.color
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {(currentStatus === 'absent' || currentStatus === 'late' || currentStatus === 'excused') && (
                <div className="mt-3 pl-11">
                  <Textarea
                    placeholder="Notes (optional)..."
                    value={notes[student.studentId] ?? ''}
                    onChange={(e) => setNotes({ ...notes, [student.studentId]: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="sticky bottom-4">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto shadow-lg">
          {saving ? 'Saving…' : isOnline ? 'Save Attendance' : 'Save Offline'}
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { generateAttendanceCodeAction } from '../../actions'
import { RefreshCw, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CodePanelProps {
  classId: string
  termId: string
}

export default function CodePanel({ classId, termId }: CodePanelProps) {
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const result = await generateAttendanceCodeAction(classId, termId)
      setCode(result.code)
      setExpiresAt(new Date(result.expiresAt))
    } finally {
      setGenerating(false)
    }
  }, [classId, termId])

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const expired = code !== null && secondsLeft === 0
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Attendance Code</h3>
      </div>

      {code === null ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-3">
            Generate a 6-digit code. Students enter it in their portal to mark themselves present.
          </p>
          <Button type="button" variant="outline" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Code'}
          </Button>
        </div>
      ) : (
        <div className="text-center">
          <div
            className={`text-5xl font-mono font-bold tracking-[0.25em] mb-2 ${
              expired ? 'text-slate-300' : 'text-slate-900'
            }`}
          >
            {code}
          </div>

          {expired ? (
            <p className="text-sm text-red-500 mb-3">Code expired</p>
          ) : (
            <p className="text-sm text-slate-500 mb-3">
              Expires in{' '}
              <span className={`font-medium ${secondsLeft < 60 ? 'text-red-600' : 'text-slate-700'}`}>
                {mins > 0 ? `${mins}m ` : ''}{String(secs).padStart(2, '0')}s
              </span>
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={generating}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {expired ? 'Generate New Code' : 'Regenerate'}
          </Button>
        </div>
      )}
    </div>
  )
}

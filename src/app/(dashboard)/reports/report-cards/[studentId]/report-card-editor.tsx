'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generateReportCommentAction, saveReportCardAction } from '../actions'
import { Sparkles, Loader2 } from 'lucide-react'

type Props = {
  studentId: string
  studentName: string
  terms: Array<{ id: string; label: string }>
  selectedTermId: string | null
  initialComments: string
  initialTeacherNotes: string
  initialPrincipalNotes: string
  aiEnabled: boolean
}

export default function ReportCardEditor({
  studentId,
  studentName,
  terms,
  selectedTermId: initial,
  initialComments,
  initialTeacherNotes,
  initialPrincipalNotes,
  aiEnabled,
}: Props) {
  const router = useRouter()
  const [isSaving, startSave] = useTransition()
  const [isGenerating, startGenerate] = useTransition()

  const [termId, setTermId] = useState(initial ?? terms[0]?.id ?? '')
  const [comments, setComments] = useState(initialComments)
  const [teacherNotes, setTeacherNotes] = useState(initialTeacherNotes)
  const [principalNotes, setPrincipalNotes] = useState(initialPrincipalNotes)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleTermChange(v: string | null) {
    if (!v) return
    setTermId(v)
    // Reload page with new term to fetch existing card
    router.push(`/reports/report-cards/${studentId}?termId=${v}`)
  }

  function handleGenerate(field: 'comments' | 'teacherNotes') {
    setError(null)
    startGenerate(async () => {
      const result = await generateReportCommentAction(studentId, termId || undefined)
      if (result.success && result.comment) {
        if (field === 'comments') setComments(result.comment)
        else setTeacherNotes(result.comment)
      } else {
        setError(result.error ?? 'Failed to generate comment.')
      }
    })
  }

  function handleSave() {
    if (!termId) {
      setError('Please select a term.')
      return
    }
    setError(null)
    setSuccess(null)
    startSave(async () => {
      const result = await saveReportCardAction(studentId, termId, {
        comments: comments || undefined,
        teacherNotes: teacherNotes || undefined,
        principalNotes: principalNotes || undefined,
      })
      if (result.success) setSuccess('Report card saved.')
      else setError(result.error ?? 'Save failed.')
    })
  }

  const AiButton = ({ field }: { field: 'comments' | 'teacherNotes' }) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => handleGenerate(field)}
      disabled={isGenerating || !termId}
      className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300"
    >
      {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      Generate with AI
    </Button>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report Card — {studentName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>
        )}

        <div className="space-y-1.5">
          <Label>Term</Label>
          <Select value={termId} onValueChange={handleTermChange}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Select term..." />
            </SelectTrigger>
            <SelectContent>
              {terms.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="comments">General Comments</Label>
            {aiEnabled && <AiButton field="comments" />}
          </div>
          <Textarea
            id="comments"
            rows={4}
            placeholder="Overall student progress and general observations..."
            value={comments}
            onChange={e => setComments(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="teacherNotes">Teacher Notes</Label>
            {aiEnabled && <AiButton field="teacherNotes" />}
          </div>
          <Textarea
            id="teacherNotes"
            rows={3}
            placeholder="Specific academic observations from the teacher..."
            value={teacherNotes}
            onChange={e => setTeacherNotes(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="principalNotes">Principal Notes</Label>
          <Textarea
            id="principalNotes"
            rows={3}
            placeholder="Message from the principal (optional)..."
            value={principalNotes}
            onChange={e => setPrincipalNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Report Card'}
          </Button>
          {termId && (
            <a
              href={`/api/report-card/${studentId}?termId=${termId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
            >
              Download PDF
            </a>
          )}
        </div>

        {aiEnabled && (
          <p className="text-xs text-slate-400">
            "Generate with AI" uses the configured AI provider to draft a comment based on grades, attendance, and behaviour data for the selected term. You can edit before saving.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createGradebookAction } from './actions'

type ClassOption = { id: string; name: string; code: string }
type TermOption = { id: string; name: string; academicYear: { year: number } }

const ASSESSMENT_TYPES = [
  { value: 'assessment', label: 'Assessment' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'project', label: 'Project' },
]

interface GradebookFormProps {
  classes: ClassOption[]
  terms: TermOption[]
  defaultClassId?: string
}

export default function GradebookForm({ classes, terms, defaultClassId }: GradebookFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [classId, setClassId] = useState(defaultClassId ?? '')
  const [termId, setTermId] = useState('')
  const [type, setType] = useState('assessment')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('classId', classId)
    formData.set('termId', termId)
    formData.set('type', type)

    try {
      const result = await createGradebookAction(formData) as { error?: string } | undefined
      if (result?.error) setError(result.error)
    } catch {
      // redirect was called — navigation handled
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Assessment Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Term 1 Exam"
            required
          />
        </div>

        {/* Class */}
        <div className="space-y-2">
          <Label>Class *</Label>
          <Select value={classId} onValueChange={(v) => { if (v !== null) setClassId(v) }} required>
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Term */}
        <div className="space-y-2">
          <Label>Term *</Label>
          <Select value={termId} onValueChange={(v) => { if (v !== null) setTermId(v) }} required>
            <SelectTrigger>
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.academicYear.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => { if (v !== null) setType(v) }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSESSMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Max Score */}
        <div className="space-y-2">
          <Label htmlFor="maxScore">Max Score</Label>
          <Input
            id="maxScore"
            name="maxScore"
            type="number"
            min={1}
            defaultValue={100}
            required
          />
        </div>

        {/* Weight */}
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            name="weight"
            type="number"
            min={0}
            step={0.1}
            defaultValue={1}
          />
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
          />
        </div>
      </div>

      {/* Document URL */}
      <div className="space-y-2">
        <Label htmlFor="documentUrl">Assignment Document URL</Label>
        <Input
          id="documentUrl"
          name="documentUrl"
          type="url"
          placeholder="https://docs.google.com/… or OneDrive link, or any URL"
        />
        <p className="text-xs text-slate-400">
          Paste a link to the assignment brief — Google Docs, OneDrive, or any URL.
          Students will see this link on their Assignments page.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Optional description..."
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Assessment'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

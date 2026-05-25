'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, X, Check, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createNoteAction, updateNoteAction, deleteNoteAction } from './note-actions'

const NOTE_TYPES = ['general', 'academic', 'medical', 'behaviour', 'pastoral'] as const
type NoteType = typeof NOTE_TYPES[number]

const TYPE_STYLES: Record<NoteType, string> = {
  general: 'bg-slate-100 text-slate-700',
  academic: 'bg-blue-50 text-blue-700',
  medical: 'bg-red-50 text-red-700',
  behaviour: 'bg-amber-50 text-amber-700',
  pastoral: 'bg-green-50 text-green-700',
}

type Note = {
  id: string
  content: string
  type: string
  private: boolean
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string }
}

type Props = {
  studentId: string
  notes: Note[]
  currentUserId: string
  isAdmin: boolean
}

function NoteCard({
  note,
  studentId,
  currentUserId,
  isAdmin,
}: {
  note: Note
  studentId: string
  currentUserId: string
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const canEdit = note.author.id === currentUserId || isAdmin

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateNoteAction(note.id, studentId, fd)
      if (result.error) setError(result.error)
      else setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm('Delete this note?')) return
    startTransition(async () => {
      const result = await deleteNoteAction(note.id, studentId)
      if (result.error) setError(result.error)
    })
  }

  const typeStyle = TYPE_STYLES[note.type as NoteType] ?? TYPE_STYLES.general

  if (editing) {
    return (
      <form onSubmit={handleSave} className="border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select name="type" defaultValue={note.type} className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm shadow-sm">
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Note</Label>
          <Textarea name="content" defaultValue={note.content} required rows={3} className="resize-none" />
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" name="private" value="true" defaultChecked={note.private} className="h-3.5 w-3.5 rounded" />
            Private (admin only)
          </label>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="xs" disabled={isPending}>
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => { setEditing(false); setError(null) }} disabled={isPending}>
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', typeStyle)}>
              {note.type.charAt(0).toUpperCase() + note.type.slice(1)}
            </span>
            {note.private && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
            <span className="text-xs text-slate-400">{note.author.name}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              {new Date(note.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
              {note.updatedAt > note.createdAt && ' (edited)'}
            </span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setEditing(true)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-slate-400 hover:text-destructive"
                onClick={handleDelete}
                disabled={isPending}
                title="Delete"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{note.content}</p>
      </CardContent>
    </Card>
  )
}

export default function StudentNotes({ studentId, notes, currentUserId, isAdmin }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createNoteAction(studentId, fd)
      if (result.error) setError(result.error)
      else { setShowForm(false); (e.target as HTMLFormElement).reset() }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" />
          Add Note
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
          <p className="text-sm font-medium text-slate-800">New Note</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select name="type" defaultValue="general" className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm shadow-sm">
                {NOTE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 pt-5">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" name="private" value="true" className="h-3.5 w-3.5 rounded" />
                  Private (admin only)
                </label>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note *</Label>
            <Textarea name="content" required rows={3} placeholder="Enter note…" className="resize-none" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save Note
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setError(null) }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {notes.length === 0 && !showForm ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm shadow-sm">
          No notes yet. Add a note to keep track of important information about this student.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              studentId={studentId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}

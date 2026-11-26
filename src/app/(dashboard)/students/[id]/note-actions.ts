'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { field, parseWith } from '@/lib/form'

const NOTE_TYPES = ['general', 'academic', 'medical', 'behaviour', 'pastoral'] as const

const noteSchema = z.object({
  content: field.required('Note content', 5000),
  type: field.oneOf('Note type', NOTE_TYPES),
})

export async function createNoteAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const parsed = parseWith(noteSchema, {
    content: formData.get('content') ?? '',
    type: formData.get('type') || 'general',
  })
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { content, type } = parsed.data
  const isPrivate = formData.get('private') === 'true' && session.role === 'admin'

  await db.studentNote.create({
    data: { studentId, authorId: session.id, content, type, private: isPrivate },
  })

  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

export async function updateNoteAction(
  noteId: string,
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const note = await db.studentNote.findUnique({ where: { id: noteId } })
  if (!note) return { success: false, error: 'Note not found.' }
  if (note.authorId !== session.id && session.role !== 'admin') {
    return { success: false, error: 'You can only edit your own notes.' }
  }

  const parsed = parseWith(noteSchema, {
    content: formData.get('content') ?? '',
    type: formData.get('type') || note.type,
  })
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { content, type } = parsed.data
  const isPrivate = session.role === 'admin' ? formData.get('private') === 'true' : note.private

  await db.studentNote.update({
    where: { id: noteId },
    data: { content, type, private: isPrivate },
  })

  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

export async function deleteNoteAction(
  noteId: string,
  studentId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const note = await db.studentNote.findUnique({ where: { id: noteId } })
  if (!note) return { success: false, error: 'Note not found.' }
  if (note.authorId !== session.id && session.role !== 'admin') {
    return { success: false, error: 'You can only delete your own notes.' }
  }

  await db.studentNote.delete({ where: { id: noteId } })
  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

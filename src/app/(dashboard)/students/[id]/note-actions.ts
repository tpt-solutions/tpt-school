'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createNoteAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const content = (formData.get('content') as string)?.trim()
  const type = (formData.get('type') as string) || 'general'
  const isPrivate = formData.get('private') === 'true' && session.role === 'admin'

  if (!content) return { success: false, error: 'Note content is required.' }

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

  const content = (formData.get('content') as string)?.trim()
  const type = (formData.get('type') as string) || note.type
  const isPrivate = session.role === 'admin' ? formData.get('private') === 'true' : note.private

  if (!content) return { success: false, error: 'Note content is required.' }

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

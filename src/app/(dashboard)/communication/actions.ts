'use server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ─── Notices ─────────────────────────────────────────────────────────────────

export async function createNoticeAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession()
    if (!['admin', 'teacher'].includes(user.role)) {
      return { success: false, error: 'Unauthorised.' }
    }

    const title = (formData.get('title') as string)?.trim()
    const body = (formData.get('body') as string)?.trim()
    const category = (formData.get('category') as string) || 'general'
    const pinned = formData.get('pinned') === 'true'
    const publishedAtRaw = formData.get('publishedAt') as string
    const expiresAtRaw = formData.get('expiresAt') as string

    // targetRoles: JSON array or "all"
    const targetRolesRaw = formData.getAll('targetRoles') as string[]
    const targetRoles = targetRolesRaw.length === 0 || targetRolesRaw.includes('all')
      ? 'all'
      : JSON.stringify(targetRolesRaw)

    // targetYears: JSON array or "all"
    const targetYearsRaw = formData.getAll('targetYears') as string[]
    const targetYears = targetYearsRaw.length === 0 || targetYearsRaw.includes('all')
      ? 'all'
      : JSON.stringify(targetYearsRaw.map(Number))

    if (!title || !body) {
      return { success: false, error: 'Title and body are required.' }
    }

    await db.notice.create({
      data: {
        title,
        body,
        category,
        pinned,
        targetRoles,
        targetYears,
        authorId: user.id,
        publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : new Date(),
        expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      },
    })

    revalidatePath('/communication')
    redirect('/communication')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('createNoticeAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function sendMessageAction(
  recipientId: string,
  subject: string,
  body: string,
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const user = await requireSession()

    if (!recipientId || !subject?.trim() || !body?.trim()) {
      return { success: false, error: 'Recipient, subject, and body are required.' }
    }

    const recipient = await db.user.findUnique({ where: { id: recipientId } })
    if (!recipient) return { success: false, error: 'Recipient not found.' }

    const message = await db.message.create({
      data: {
        senderId: user.id,
        subject: subject.trim(),
        body: body.trim(),
        recipients: {
          create: { userId: recipientId },
        },
      },
    })

    revalidatePath('/communication/messages')
    return { success: true, id: message.id }
  } catch (err: unknown) {
    console.error('sendMessageAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function markMessageReadAction(messageId: string): Promise<void> {
  try {
    const user = await requireSession()
    await db.messageRecipient.updateMany({
      where: { messageId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
  } catch (err) {
    console.error('markMessageReadAction error:', err)
  }
}

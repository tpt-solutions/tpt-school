'use server'

import { db } from '@/lib/db'
import { requireSession, requireRole } from '@/lib/auth'
import { canMessage } from '@/lib/access'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { field, formList, formRecord, parseWith } from '@/lib/form'

// ─── Notices ─────────────────────────────────────────────────────────────────

export async function createNoticeAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    // School-wide notices are published by admins only
    const user = await requireRole(['admin'])

    const noticeSchema = z.object({
      title: field.required('Title', 200),
      body: field.required('Body', 10000),
      category: field.optional('Category', 50).transform(v => v ?? 'general'),
      publishedAt: field.optionalDate('Publish date'),
      expiresAt: field.optionalDate('Expiry date'),
    })
    const parsed = parseWith(noticeSchema, formRecord(formData))
    if (!parsed.ok) return { success: false, error: parsed.error }
    const { title, body, category, publishedAt, expiresAt } = parsed.data
    const pinned = formData.get('pinned') === 'true'

    if (publishedAt && expiresAt && expiresAt < publishedAt) {
      return { success: false, error: 'Expiry date cannot be before the publish date.' }
    }

    // targetRoles: JSON array or "all"
    const ROLES = ['admin', 'teacher', 'parent', 'student'] as const
    const targetRolesRaw = formList(formData, 'targetRoles')
    if (!targetRolesRaw.every(r => (ROLES as readonly string[]).includes(r) || r === 'all')) {
      return { success: false, error: 'Invalid audience role.' }
    }
    const targetRoles = targetRolesRaw.length === 0 || targetRolesRaw.includes('all')
      ? 'all'
      : JSON.stringify(targetRolesRaw)

    // targetYears: JSON array of year levels, or "all"
    const targetYearsRaw = formList(formData, 'targetYears')
    if (!targetYearsRaw.every(y => y === 'all' || /^\d{1,2}$/.test(y) && Number(y) <= 20)) {
      return { success: false, error: 'Year levels must be whole numbers between 0 and 20.' }
    }
    const targetYears = targetYearsRaw.length === 0 || targetYearsRaw.includes('all')
      ? 'all'
      : JSON.stringify(targetYearsRaw.map(Number))

    await db.notice.create({
      data: {
        title,
        body,
        category,
        pinned,
        targetRoles,
        targetYears,
        authorId: user.id,
        publishedAt: publishedAt ?? new Date(),
        expiresAt,
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
    if (!(await canMessage(user, recipientId))) {
      return { success: false, error: 'You are not allowed to message this person.' }
    }

    // Create root message — threadId must equal message.id, so we do a two-step write
    const message = await db.message.create({
      data: {
        senderId: user.id,
        subject: subject.trim(),
        body: body.trim(),
        threadId: 'pending', // temporary; updated below
        recipients: {
          create: { userId: recipientId },
        },
      },
    })
    await db.message.update({ where: { id: message.id }, data: { threadId: message.id } })

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

export async function recordNoticeReadAction(noticeId: string): Promise<void> {
  try {
    const user = await requireSession()
    await db.noticeRead.upsert({
      where: { noticeId_userId: { noticeId, userId: user.id } },
      create: { noticeId, userId: user.id },
      update: {},
    })
  } catch (err) {
    console.error('recordNoticeReadAction error:', err)
  }
}

export async function sendReplyAction(
  threadId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession()

    if (!body?.trim()) return { success: false, error: 'Reply body is required.' }

    // Load the root (thread) message to find the other participant
    const root = await db.message.findUnique({
      where: { id: threadId },
      include: { recipients: true },
    })
    if (!root) return { success: false, error: 'Thread not found.' }

    // Check access
    const isParticipant =
      root.senderId === user.id || root.recipients.some(r => r.userId === user.id)
    if (!isParticipant) return { success: false, error: 'Not authorised.' }

    // If the replier is NOT the original sender, check allowParentReplies
    if (user.id !== root.senderId) {
      const staffRecord = await db.staff.findFirst({ where: { userId: root.senderId } })
      if (staffRecord && !staffRecord.allowParentReplies) {
        return { success: false, error: 'This staff member has disabled replies.' }
      }
    }

    // Determine reply recipient (the other person in the thread)
    const recipientId =
      root.senderId === user.id
        ? root.recipients[0]?.userId
        : root.senderId

    if (!recipientId) return { success: false, error: 'Cannot determine reply recipient.' }
    if (!(await canMessage(user, recipientId))) {
      return { success: false, error: 'You are not allowed to message this person.' }
    }

    await db.message.create({
      data: {
        senderId: user.id,
        subject: null,
        body: body.trim(),
        parentId: threadId,
        threadId,
        recipients: { create: { userId: recipientId } },
      },
    })

    revalidatePath(`/communication/messages/${threadId}`)
    revalidatePath('/communication/messages')
    revalidatePath('/portal/messages')
    return { success: true }
  } catch (err) {
    console.error('sendReplyAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateMessagingSettingsAction(
  parentMessagingDefault: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])
    const existing = await db.schoolSettings.findFirst()
    if (!existing) return { success: false, error: 'School settings not found.' }
    await db.schoolSettings.update({
      where: { id: existing.id },
      data: { parentMessagingDefault },
    })
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    console.error('updateMessagingSettingsAction error:', err)
    return { success: false, error: 'Failed to update settings.' }
  }
}

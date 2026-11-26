'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseAmountToCents, formatCents } from '@/lib/money'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const itemSchema = z.object({
  name: field.required('Item name', 100),
  category: field.optional('Category', 50).transform(v => v ?? 'food'),
})

const purchaseSchema = z.object({
  itemId: field.required('Item', 64),
  studentId: field.required('Student', 64),
  quantity: field.int('Quantity', 1, 20),
})

const idSchema = z.object({ id: field.required('Item', 64) })

export async function createCanteenItemAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(itemSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  const priceCents = parseAmountToCents(formData.get('price') as string | null)
  if (priceCents === null || priceCents <= 0) {
    return { success: false, error: 'Price must be greater than zero, with at most two decimal places.' }
  }

  const item = await db.canteenItem.create({
    data: { name: parsed.data.name, category: parsed.data.category, priceCents },
  })
  await logAudit(session.id, 'CREATE', 'CanteenItem', `Added canteen item ${parsed.data.name}`, item.id)

  revalidatePath('/canteen')
  return { success: true }
}

export async function setCanteenItemActiveAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  await db.canteenItem.update({
    where: { id: parsed.data.id },
    data: { active: formData.get('active') === 'true' },
  })

  revalidatePath('/canteen')
  return { success: true }
}

export async function recordCanteenPurchaseAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(purchaseSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { itemId, studentId, quantity } = parsed.data

  const item = await db.canteenItem.findUnique({ where: { id: itemId } })
  if (!item) return { success: false, error: 'Item not found.' }
  if (!item.active) return { success: false, error: 'This item is no longer on sale.' }

  // Price is captured from the item at purchase time, so later price changes do not alter history
  const totalCents = item.priceCents * quantity
  await db.canteenPurchase.create({
    data: { studentId, itemId, quantity, totalCents, recordedById: session.id },
  })
  await logAudit(session.id, 'CREATE', 'CanteenPurchase', `Recorded ${quantity} × ${item.name} (${formatCents(totalCents)})`, studentId)

  revalidatePath('/canteen')
  return { success: true }
}

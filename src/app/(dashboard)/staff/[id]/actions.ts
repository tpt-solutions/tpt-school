'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateStaffAllowRepliesAction(staffId: string, value: boolean): Promise<void> {
  await requireRole(['admin'])
  await db.staff.update({ where: { id: staffId }, data: { allowParentReplies: value } })
  revalidatePath(`/staff/${staffId}`)
}

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, parseWith } from '@/lib/form'
import { parseAmountToCents } from '@/lib/money'

const MAX_IMPORT_ROWS = 1000

const feeTypeRowSchema = z.object({
  name: field.required('Fee name', 120),
  description: field.optional('Description', 500),
  amount: z
    .string({ message: 'Amount is required.' })
    .trim()
    .min(1, { message: 'Amount is required.' })
    .transform((v, ctx) => {
      const cents = parseAmountToCents(v)
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: 'custom', message: 'Amount must be a number of dollars, for example 150 or 85.50.' })
        return z.NEVER
      }
      return cents
    }),
  frequency: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    field.oneOf('Frequency', ['annual', 'term'] as const).default('annual'),
  ),
  yearLevel: field.optionalInt('Year level', 0, 20),
})

export type ImportFeeTypesResult = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Creates fee types. A fee type whose name already exists is skipped, so re-running is safe.
 * Amounts are converted to integer cents before storage.
 */
export async function importFeeTypesAction(rows: Record<string, string>[]): Promise<ImportFeeTypesResult> {
  const user = await requireRole(['admin'])

  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, imported: 0, skipped: 0, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`] }
  }

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const raw of rows) {
    const parsed = parseWith(feeTypeRowSchema, raw)
    if (!parsed.ok) {
      errors.push(`Row for ${raw?.name || '?'}: ${parsed.error}`)
      continue
    }
    const row = parsed.data
    try {
      const existing = await db.feeType.findFirst({ where: { name: row.name }, select: { id: true } })
      if (existing) {
        skipped++
        continue
      }
      await db.feeType.create({
        data: {
          name: row.name,
          description: row.description,
          amountCents: row.amount,
          frequency: row.frequency,
          yearLevel: row.yearLevel,
        },
      })
      imported++
    } catch (err) {
      console.error('Fee type import row failed:', err)
      errors.push(`Row for ${row.name}: could not be saved.`)
    }
  }

  if (imported > 0) {
    await logAudit(user.id, 'CREATE', 'FeeType', `Imported ${imported} fee type(s) (${skipped} skipped)`)
    revalidatePath('/finance')
    revalidatePath('/finance/fee-types')
  }

  return { success: errors.length === 0 || imported > 0, imported, skipped, errors }
}

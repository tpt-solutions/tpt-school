'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, parseWith } from '@/lib/form'

// Keep one request bounded. Each row is a separate write.
const MAX_IMPORT_ROWS = 1000

// Checked on the server for every row: the browser preview is not a security boundary.
const classRowSchema = z.object({
  name: field.required('Class name', 120),
  code: field.required('Class code', 30),
  subject: field.optional('Subject', 120),
  yearLevel: field.optionalInt('Year level', 0, 20),
  maxStudents: field.optionalInt('Max students', 1, 1000),
  periodsPerWeek: field.optionalInt('Periods per week', 1, 40),
  description: field.optional('Description', 1000),
})

export type ImportClassesResult = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Creates classes in the active academic year. A row whose code already exists in that year is
 * skipped, so re-running an import is safe. Each row is validated on the server.
 */
export async function importClassesAction(rows: Record<string, string>[]): Promise<ImportClassesResult> {
  const user = await requireRole(['admin'])

  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, imported: 0, skipped: 0, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`] }
  }

  const activeYear = await db.academicYear.findFirst({ where: { active: true }, select: { id: true, year: true } })
  if (!activeYear) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: ['No active academic year. Set one in Settings before importing classes.'],
    }
  }

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const raw of rows) {
    const parsed = parseWith(classRowSchema, raw)
    if (!parsed.ok) {
      errors.push(`Row for ${raw?.code || raw?.name || '?'}: ${parsed.error}`)
      continue
    }
    const row = parsed.data
    try {
      const existing = await db.class.findFirst({
        where: { academicYearId: activeYear.id, code: row.code },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }
      await db.class.create({
        data: {
          academicYearId: activeYear.id,
          name: row.name,
          code: row.code,
          subject: row.subject,
          yearLevel: row.yearLevel,
          maxStudents: row.maxStudents,
          periodsPerWeek: row.periodsPerWeek ?? 5,
          description: row.description,
        },
      })
      imported++
    } catch (err) {
      console.error('Class import row failed:', err)
      errors.push(`Row for ${row.code}: could not be saved.`)
    }
  }

  if (imported > 0) {
    await logAudit(
      user.id,
      'CREATE',
      'Class',
      `Imported ${imported} class(es) into ${activeYear.year} (${skipped} skipped)`,
    )
    revalidatePath('/classes')
  }

  return { success: errors.length === 0 || imported > 0, imported, skipped, errors }
}

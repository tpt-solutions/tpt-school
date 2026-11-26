'use server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransactionClient = any

import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { field, parseWith } from '@/lib/form'

type SchoolInfo = {
  name: string
  shortName: string
  address: string
  phone: string
  email: string
  schoolType: string
  country?: string
  currentYear: string
}

const COUNTRY_CODES = ['nz', 'au', 'uk', 'ca', 'other'] as const

type TermInput = {
  name: string
  startDate: string
  endDate: string
}

type AcademicYearInput = {
  startDate: string
  endDate: string
  terms: TermInput[]
}

class SetupError extends Error {}

type AdminInfo = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

const termSchema = z.object({
  name: field.required('Term name', 60),
  startDate: field.date('Term start date'),
  endDate: field.date('Term end date'),
})

const academicYearSchema = z.object({
  startDate: field.date('Year start date'),
  endDate: field.date('Year end date'),
  terms: z
    .array(termSchema)
    .min(1, { message: 'Add at least one term.' })
    .max(4, { message: 'A year can have at most 4 terms.' }),
})

/**
 * Validates the academic-year step. Returns an error message or null.
 * Checks date order, that terms sit inside the year, and that terms do not overlap.
 */
function validateAcademicYear(input: AcademicYearInput, year: number) {
  const parsed = parseWith(academicYearSchema, input)
  if (!parsed.ok) return parsed

  const { startDate, endDate, terms } = parsed.data
  if (startDate >= endDate) return { ok: false as const, error: 'The year must end after it starts.' }
  // The year must overlap the chosen calendar year, e.g. Sep 2026 to Jun 2027 for year 2026.
  if (startDate.getUTCFullYear() > year || endDate.getUTCFullYear() < year)
    return { ok: false as const, error: 'The academic year dates must include the current year.' }

  let previousEnd: Date | null = null
  for (const term of terms) {
    if (term.startDate >= term.endDate)
      return { ok: false as const, error: `"${term.name}" must end after it starts.` }
    if (term.startDate < startDate || term.endDate > endDate)
      return { ok: false as const, error: `"${term.name}" must fall within the academic year.` }
    if (previousEnd && term.startDate < previousEnd)
      return { ok: false as const, error: `"${term.name}" overlaps the previous term.` }
    previousEnd = term.endDate
  }
  return { ok: true as const, data: parsed.data }
}

export async function completeSetupAction(
  schoolInfo: SchoolInfo,
  adminInfo: AdminInfo,
  academicYear: AcademicYearInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate
    if (!schoolInfo.name?.trim()) return { success: false, error: 'School name is required.' }
    const year = Number(schoolInfo.currentYear)
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      return { success: false, error: 'Current year must be between 2000 and 2100.' }
    if (!adminInfo.name?.trim()) return { success: false, error: 'Admin name is required.' }
    if (!adminInfo.email?.trim()) return { success: false, error: 'Admin email is required.' }
    if (!adminInfo.password || adminInfo.password.length < 8)
      return { success: false, error: 'Password must be at least 8 characters.' }
    if (adminInfo.password !== adminInfo.confirmPassword)
      return { success: false, error: 'Passwords do not match.' }

    if (schoolInfo.country && !(COUNTRY_CODES as readonly string[]).includes(schoolInfo.country)) {
      return { success: false, error: 'Choose a school year system from the list.' }
    }

    const yearResult = validateAcademicYear(academicYear, year)
    if (!yearResult.ok) return { success: false, error: yearResult.error }
    const yearData = yearResult.data

    const passwordHash = await hashPassword(adminInfo.password)

    // The "already set up" and duplicate checks must happen inside the same
    // transaction as the writes, otherwise two concurrent submissions can both pass.
    await db.$transaction(async (tx: TransactionClient) => {
      const existing = await tx.schoolSettings.findFirst()
      if (existing?.setupComplete) throw new SetupError('Setup has already been completed.')

      const existingUser = await tx.user.findUnique({
        where: { email: adminInfo.email.trim().toLowerCase() },
      })
      if (existingUser) throw new SetupError('An account with this email already exists.')

      const settingsData = {
        name: schoolInfo.name.trim(),
        shortName: schoolInfo.shortName?.trim() || null,
        address: schoolInfo.address?.trim() || null,
        phone: schoolInfo.phone?.trim() || null,
        email: schoolInfo.email?.trim().toLowerCase() || null,
        schoolType: schoolInfo.schoolType,
        currentYear: year,
        country: schoolInfo.country || null,
        setupComplete: true,
      }

      // Create or update SchoolSettings
      if (existing) {
        await tx.schoolSettings.update({ where: { id: existing.id }, data: settingsData })
      } else {
        await tx.schoolSettings.create({ data: settingsData })
      }

      // Create the first academic year (active) with its terms
      await tx.academicYear.create({
        data: {
          year,
          startDate: yearData.startDate,
          endDate: yearData.endDate,
          active: true,
          terms: {
            create: yearData.terms.map((term, i) => ({
              termNumber: i + 1,
              name: term.name,
              startDate: term.startDate,
              endDate: term.endDate,
            })),
          },
        },
      })

      // Create admin user
      await tx.user.create({
        data: {
          name: adminInfo.name.trim(),
          email: adminInfo.email.trim().toLowerCase(),
          passwordHash,
          role: 'admin',
          active: true,
        },
      })
    })

    return { success: true }
  } catch (err) {
    if (err instanceof SetupError) return { success: false, error: err.message }
    console.error('Setup error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

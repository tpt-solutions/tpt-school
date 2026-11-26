import { z } from 'zod'

/**
 * Shared zod helpers for server actions that read FormData.
 *
 * Usage:
 *   const schema = z.object({ name: field.required(120, 'Name'), ... })
 *   const parsed = parseWith(schema, formRecord(formData))
 *   if (!parsed.ok) return { success: false, error: parsed.error }
 *   parsed.data.name // typed, trimmed, validated
 */

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** First string value per key. Missing keys are simply absent. */
export function formRecord(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !(key in out)) out[key] = value
  }
  return out
}

/** All string values for a repeated key (checkboxes, line items). */
export function formList(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === 'string')
}

export function parseWith<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data as z.output<S> }
  return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid input.' }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?$/

function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  // Date.parse rolls impossible dates over (e.g. 2026-02-30 -> 2026-03-02), so check the calendar fields round-trip.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return false
  return !Number.isNaN(Date.parse(value))
}

export const field = {
  /** Non-empty trimmed text with a maximum length. */
  required(label: string, max = 255) {
    return z
      .string({ message: `${label} is required.` })
      .trim()
      .min(1, { message: `${label} is required.` })
      .max(max, { message: `${label} must be ${max} characters or fewer.` })
  },

  /** Trimmed text that may be empty; empty becomes null. */
  optional(label: string, max = 255) {
    return z
      .string()
      .trim()
      .max(max, { message: `${label} must be ${max} characters or fewer.` })
      .nullish()
      .transform(v => (v ? v : null))
  },

  /** Required YYYY-MM-DD (optionally with time) that parses to a real date. */
  date(label: string) {
    return z
      .string({ message: `${label} is required.` })
      .trim()
      .min(1, { message: `${label} is required.` })
      .refine(isValidDateString, { message: `${label} must be a valid date.` })
      .transform(v => new Date(v))
  },

  /** Optional date; empty becomes null. */
  optionalDate(label: string) {
    return z
      .string()
      .trim()
      .nullish()
      .refine(v => !v || isValidDateString(v), { message: `${label} must be a valid date.` })
      .transform(v => (v ? new Date(v) : null))
  },

  /** Whole number in [min, max]. */
  int(label: string, min: number, max: number) {
    return z
      .string({ message: `${label} is required.` })
      .trim()
      .regex(/^-?\d+$/, { message: `${label} must be a whole number.` })
      .transform(Number)
      .pipe(
        z
          .number()
          .int({ message: `${label} must be a whole number.` })
          .min(min, { message: `${label} must be at least ${min}.` })
          .max(max, { message: `${label} must be ${max} or less.` }),
      )
  },

  /** Optional whole number; empty becomes null. */
  optionalInt(label: string, min: number, max: number) {
    return z
      .string()
      .trim()
      .nullish()
      .transform(v => (v ? v : null))
      .pipe(
        z.union([
          z.null(),
          z
            .string()
            .regex(/^-?\d+$/, { message: `${label} must be a whole number.` })
            .transform(Number)
            .pipe(
              z
                .number()
                .int({ message: `${label} must be a whole number.` })
                .min(min, { message: `${label} must be at least ${min}.` })
                .max(max, { message: `${label} must be ${max} or less.` }),
            ),
        ]),
      )
  },

  /** Optional http(s) URL. Rejects javascript:, data: and other schemes. */
  optionalHttpUrl(label: string) {
    return z
      .string()
      .trim()
      .max(2048, { message: `${label} is too long.` })
      .nullish()
      .refine(
        v => {
          if (!v) return true
          try {
            const url = new URL(v)
            return url.protocol === 'http:' || url.protocol === 'https:'
          } catch {
            return false
          }
        },
        { message: `${label} must be a valid http or https address.` },
      )
      .transform(v => (v ? v : null))
  },

  /** Optional email address. */
  optionalEmail(label: string) {
    return z
      .string()
      .trim()
      .max(254, { message: `${label} is too long.` })
      .nullish()
      .refine(v => !v || z.email().safeParse(v).success, { message: `${label} must be a valid email address.` })
      .transform(v => (v ? v : null))
  },

  /** Value must be one of the given options. */
  oneOf<const T extends readonly [string, ...string[]]>(label: string, options: T) {
    return z.enum(options, { message: `${label} must be one of: ${options.join(', ')}.` })
  },
}

/** Checkbox semantics: HTML forms send "on" (or "true") when ticked, nothing otherwise. */
export function checkbox(value: string | null | undefined): boolean {
  return value === 'on' || value === 'true'
}

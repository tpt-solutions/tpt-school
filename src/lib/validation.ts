import { z } from "zod";

/**
 * Shared input checks for server actions. Each returns an error message for the
 * first problem found, or null when the input is acceptable.
 */

const emailSchema = z.email({ message: "Enter a valid email address." }).max(254);

const isoDateSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date." });

/** Optional date string: empty is allowed, otherwise it must parse. */
function checkOptionalDate(label: string, raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const result = isoDateSchema.safeParse(raw);
  return result.success ? null : `${label} is not a valid date.`;
}

/** Year level must be a whole number in a sensible school range when given. */
function checkYearLevel(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 20) return "Year level must be a whole number between 0 and 20.";
  return null;
}

export function checkPersonFields(input: {
  email: string;
  dateOfBirth?: string | null;
  enrollmentDate?: string | null;
  dateHired?: string | null;
  yearLevel?: string | null;
}): string | null {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return email.error.issues[0]?.message ?? "Enter a valid email address.";

  return (
    checkOptionalDate("Date of birth", input.dateOfBirth) ??
    checkOptionalDate("Enrolment date", input.enrollmentDate) ??
    checkOptionalDate("Date hired", input.dateHired) ??
    checkYearLevel(input.yearLevel) ??
    null
  );
}

/** Leave and similar ranges: both dates valid and end not before start. */
export function checkDateRange(startRaw: string, endRaw: string): string | null {
  const start = Date.parse(startRaw);
  const end = Date.parse(endRaw);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Enter valid start and end dates.";
  if (end < start) return "End date cannot be before start date.";
  return null;
}

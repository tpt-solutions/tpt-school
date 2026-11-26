/**
 * Money is stored as integer cents everywhere. Floats are only used at the
 * edges: parsing what a user typed, and formatting for display.
 */

const DOLLARS_PATTERN = /^\d{1,9}(\.\d{1,2})?$/

/**
 * Parses a user-entered amount ("12", "12.5", "12.50") into integer cents.
 * Returns null for anything else (negatives, more than two decimals, NaN, empty).
 */
export function parseAmountToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  const text = String(input).trim()
  if (!DOLLARS_PATTERN.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const cents = parseInt(whole, 10) * 100 + parseInt(fraction.padEnd(2, '0'), 10)
  return Number.isSafeInteger(cents) ? cents : null
}

/** Formats integer cents for display, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number, symbol = '$'): string {
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100).toLocaleString('en-NZ')
  const fraction = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${symbol}${whole}.${fraction}`
}

/** Plain decimal string for exports and emails, e.g. 123456 -> "1234.56". */
export function centsToDecimalString(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

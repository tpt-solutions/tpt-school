import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * iCalendar (RFC 5545) feed helpers.
 *
 * Calendar apps subscribe by URL and do not send session cookies, so each feed URL carries a
 * token: HMAC-SHA256 of the user id, keyed with AUTH_SECRET. The token is stable per user, so
 * it stays valid until AUTH_SECRET changes. Rotating the secret invalidates every feed URL.
 */

const DEV_FALLBACK_SECRET = 'insecure-dev-secret-replace-in-prod'

function signingSecret(): string {
  const configured = process.env.AUTH_SECRET
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production to sign calendar feed URLs')
  }
  return configured || DEV_FALLBACK_SECRET
}

export function calendarFeedToken(userId: string): string {
  return createHmac('sha256', signingSecret()).update(`ical:${userId}`).digest('base64url')
}

export function isValidCalendarFeedToken(userId: string, token: string): boolean {
  const expected = Buffer.from(calendarFeedToken(userId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export type FeedEvent = {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  allDay: boolean
  category: string
  updatedAt: Date
}

/** Escapes TEXT values per RFC 5545 section 3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** Folds content lines to 75 octets, continuing with a leading space (RFC 5545 section 3.1). */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  let limit = 75
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    // Do not split a multi-byte UTF-8 character: back up to a character boundary.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    parts.push(bytes.subarray(start, end).toString('utf8'))
    start = end
    limit = 74 // continuation lines start with a space, which counts toward the limit
  }
  return parts.join('\r\n ')
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function dateOnly(date: Date): string {
  // All-day events are stored as UTC midnight; use the UTC calendar date.
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Builds a VCALENDAR document. Lines are joined with CRLF as the spec requires. */
export function buildIcs(calendarName: string, events: FeedEvent[], host: string, now = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TPT School//School Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ]

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@${host}`)
    lines.push(`DTSTAMP:${utcStamp(now)}`)
    lines.push(`LAST-MODIFIED:${utcStamp(e.updatedAt)}`)
    if (e.allDay) {
      // DTEND is exclusive for all-day events, so add one day to an inclusive end date.
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.startDate)}`)
      lines.push(`DTEND;VALUE=DATE:${dateOnly(addDays(e.endDate, 1))}`)
    } else {
      lines.push(`DTSTART:${utcStamp(e.startDate)}`)
      lines.push(`DTEND:${utcStamp(e.endDate)}`)
    }
    lines.push(`SUMMARY:${escapeIcsText(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`)
    lines.push(`CATEGORIES:${escapeIcsText(e.category)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

/** The feed path for a user, relative to the site origin. */
export function calendarFeedPath(userId: string): string {
  const params = new URLSearchParams({ u: userId, t: calendarFeedToken(userId) })
  return `/api/calendar/feed?${params.toString()}`
}

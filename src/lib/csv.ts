/**
 * Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes ("") and commas or line
 * breaks inside quotes, CRLF or LF line endings, and a leading UTF-8 byte-order mark.
 * Client-safe: no server imports.
 *
 * Returns one object per data row, keyed by the header row. Missing cells become "".
 */
export function parseCsv(text: string): Record<string, string>[] {
  const input = text.replace(/^﻿/, '')
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      records.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  // Last record without a trailing newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  // Drop blank lines (a single empty cell).
  const nonBlank = records.filter(r => !(r.length === 1 && r[0].trim() === ''))
  if (nonBlank.length < 2) return []

  const headers = nonBlank[0].map(h => h.trim())
  return nonBlank.slice(1).map(cells => {
    const out: Record<string, string> = {}
    headers.forEach((h, idx) => {
      out[h] = (cells[idx] ?? '').trim()
    })
    return out
  })
}

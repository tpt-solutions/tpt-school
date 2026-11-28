'use client'

import { useEffect, useState } from 'react'
import { parseCsv } from '@/lib/csv'

/**
 * Shows what a finished file looks like: the header and the first few example rows
 * from the downloadable template, so users can see the format before uploading.
 */
export default function CsvExamplePreview({ href, maxRows = 3 }: { href: string; maxRows?: number }) {
  const [state, setState] = useState<{ columns: string[]; rows: Record<string, string>[] } | 'error' | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(href)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then(text => {
        if (cancelled) return
        const rows = parseCsv(text)
        // parseCsv keys rows by header, so the header is the first row's keys
        const columns = rows[0] ? Object.keys(rows[0]) : []
        setState({ columns, rows: rows.slice(0, maxRows) })
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [href, maxRows])

  if (state === null) return <p className="text-xs text-slate-400">Loading example…</p>
  if (state === 'error') return null
  if (state.rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-xs">
        <caption className="sr-only">Example rows from the template</caption>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {state.columns.map(col => (
              <th key={col} scope="col" className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {state.rows.map((row, i) => (
            <tr key={i}>
              {state.columns.map(col => (
                <td key={col} className="px-2 py-1.5 whitespace-nowrap">
                  {row[col] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

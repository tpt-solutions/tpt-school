'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function SisDownloadButtons() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const attendanceHref = `/api/export/sis/attendance${from || to ? `?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}` : ''}`

  return (
    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
      <p className="text-sm font-medium text-slate-700 mb-3">Attendance date range filter (optional)</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          From
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          To
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm"
          />
        </label>
        <a
          href={attendanceHref}
          download="attendance.csv"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 bg-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download attendance.csv
        </a>
      </div>
    </div>
  )
}

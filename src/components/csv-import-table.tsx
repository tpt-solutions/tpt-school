'use client'

import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export type CsvRow = {
  rowNum: number
  data: Record<string, string>
  errors: string[]
  warnings: string[]
}

type Props = {
  rows: CsvRow[]
  columns: string[]
}

export default function CsvImportTable({ rows, columns }: Props) {
  if (rows.length === 0) return null

  const validCount = rows.filter(r => r.errors.length === 0).length
  const errorCount = rows.filter(r => r.errors.length > 0).length
  const warnCount = rows.filter(r => r.warnings.length > 0 && r.errors.length === 0).length

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          {validCount} valid
        </span>
        {warnCount > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            {warnCount} warnings
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-600">
            <XCircle className="w-4 h-4" />
            {errorCount} errors
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-medium text-slate-500 w-10">#</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500 w-8">Status</th>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left font-medium text-slate-500 whitespace-nowrap">
                  {col}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium text-slate-500">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => {
              const hasError = row.errors.length > 0
              const hasWarn = row.warnings.length > 0
              return (
                <tr
                  key={row.rowNum}
                  className={hasError ? 'bg-red-50' : hasWarn ? 'bg-amber-50' : 'bg-white'}
                >
                  <td className="px-3 py-2 text-slate-400">{row.rowNum}</td>
                  <td className="px-3 py-2">
                    {hasError ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : hasWarn ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </td>
                  {columns.map(col => (
                    <td key={col} className="px-3 py-2 text-slate-700 max-w-[160px] truncate">
                      {row.data[col] ?? ''}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {row.errors.map((e, i) => (
                      <p key={i} className="text-red-600">{e}</p>
                    ))}
                    {row.warnings.map((w, i) => (
                      <p key={i} className="text-amber-600">{w}</p>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

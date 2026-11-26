'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CsvImportTable, { type CsvRow } from '@/components/csv-import-table'
import { parseCsv } from '@/lib/csv'
import { Download, Upload } from 'lucide-react'

export type CsvRowCheck = { errors: string[]; warnings: string[] }

export type CsvImportOutcome = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

type Props = {
  /** Column names in display order. Required columns are marked with * in the help text. */
  columns: string[]
  /** Human-readable format notes shown above the upload box. */
  formatHelp: string
  templateHref: string
  /** Browser-side checks for quick feedback. The server re-validates every row. */
  validate: (data: Record<string, string>) => CsvRowCheck
  importRows: (rows: Record<string, string>[]) => Promise<CsvImportOutcome>
  successHref: string
  entityLabel: string
  maxRows?: number
}

export default function CsvImportPanel({
  columns,
  formatHelp,
  templateHref,
  validate,
  importRows,
  successHref,
  entityLabel,
  maxRows = 1000,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<CsvRow[]>([])
  const [result, setResult] = useState<CsvImportOutcome | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setFileError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const raw = parseCsv(String(ev.target?.result ?? ''))
        if (raw.length === 0) {
          setFileError('No data rows found. Check that the file has a header row and at least one data row.')
          setRows([])
          return
        }
        if (raw.length > maxRows) {
          setFileError(`Import is limited to ${maxRows} rows at a time. This file has ${raw.length}.`)
          setRows([])
          return
        }
        setRows(
          raw.map((data, i) => {
            const check = validate(data)
            return { rowNum: i + 2, data, errors: check.errors, warnings: check.warnings }
          }),
        )
      } catch {
        setFileError('Failed to parse CSV.')
      }
    }
    reader.readAsText(file)
  }

  const validRows = rows.filter(r => r.errors.length === 0)

  function handleImport() {
    if (validRows.length === 0) return
    startTransition(async () => {
      const outcome = await importRows(validRows.map(r => r.data))
      setResult(outcome)
      if (outcome.imported > 0) {
        setTimeout(() => router.push(successHref), 2000)
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CSV format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Your CSV needs a header row with these columns (required columns end in *):</p>
          <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-slate-700 overflow-x-auto whitespace-nowrap">
            {columns.join(', ')}
          </div>
          <p className="text-xs text-slate-500">{formatHelp}</p>
          <a href={templateHref} download className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <Download className="w-4 h-4" aria-hidden="true" />
            Download blank template with example rows
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg px-6 py-10 cursor-pointer hover:border-primary/40 hover:bg-slate-50 transition-colors focus-within:ring-2 focus-within:ring-primary">
            <Upload className="w-8 h-8 text-slate-400 mb-2" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700">Click to upload a CSV file</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
          {fileError && <p role="alert" className="text-sm text-red-600 mt-3">{fileError}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Preview ({rows.length} row{rows.length !== 1 ? 's' : ''}, {validRows.length} valid)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CsvImportTable rows={rows} columns={columns} />

            {result ? (
              <div role="status" className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 space-y-1">
                <p className="font-medium">Import complete</p>
                <p>{result.imported} {entityLabel} imported, {result.skipped} skipped</p>
                {result.errors.map((e, i) => <p key={i} className="text-red-600">{e}</p>)}
                {result.imported > 0 && <p className="text-emerald-600">Redirecting…</p>}
              </div>
            ) : (
              <Button onClick={handleImport} disabled={isPending || validRows.length === 0}>
                {isPending ? 'Importing…' : `Import ${validRows.length} valid row${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

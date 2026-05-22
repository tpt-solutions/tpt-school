'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CsvImportTable, { CsvRow } from '@/components/csv-import-table'
import { importStaffAction, ImportStaffRow } from './actions'
import { Upload } from 'lucide-react'

const COLUMNS = ['firstName', 'lastName', 'email', 'jobTitle', 'department', 'employmentType', 'dateHired']

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

function validateRows(raw: Record<string, string>[]): CsvRow[] {
  return raw.map((data, i) => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.firstName) errors.push('firstName is required')
    if (!data.lastName) errors.push('lastName is required')
    if (!data.email) errors.push('email is required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Invalid email format')

    if (data.dateHired && isNaN(Date.parse(data.dateHired))) {
      errors.push('Invalid dateHired (use YYYY-MM-DD)')
    }

    const validEmploymentTypes = ['full-time', 'part-time', 'casual', 'contract']
    if (data.employmentType && !validEmploymentTypes.includes(data.employmentType.toLowerCase())) {
      warnings.push(`Unknown employmentType "${data.employmentType}" — will default to full-time`)
    }

    return { rowNum: i + 2, data, errors, warnings }
  })
}

export default function StaffImportClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<CsvRow[]>([])
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setFileError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const raw = parseCSV(text)
        if (raw.length === 0) {
          setFileError('No data rows found.')
          setRows([])
          return
        }
        setRows(validateRows(raw))
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
      const payload: ImportStaffRow[] = validRows.map(r => ({
        firstName: r.data.firstName,
        lastName: r.data.lastName,
        email: r.data.email,
        jobTitle: r.data.jobTitle || undefined,
        department: r.data.department || undefined,
        employmentType: r.data.employmentType || undefined,
        dateHired: r.data.dateHired || undefined,
      }))
      const res = await importStaffAction(payload)
      setResult(res)
      if (res.imported > 0) {
        setTimeout(() => router.push('/staff'), 2000)
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CSV Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Your CSV must have a header row with these columns (required marked with *):
          </p>
          <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-slate-700 overflow-x-auto whitespace-nowrap">
            firstName*, lastName*, email*, jobTitle, department, employmentType, dateHired
          </div>
          <p className="text-xs text-slate-500">
            employmentType: full-time | part-time | casual | contract. Dates in YYYY-MM-DD format. Staff with existing email are skipped.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg px-6 py-10 cursor-pointer hover:border-primary/40 hover:bg-slate-50 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-700">Click to upload a CSV file</span>
            <span className="text-xs text-slate-500 mt-1">or drag and drop</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
          {fileError && <p className="text-sm text-red-600 mt-3">{fileError}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preview ({rows.length} row{rows.length !== 1 ? 's' : ''})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CsvImportTable rows={rows} columns={COLUMNS} />

            {result ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 space-y-1">
                <p className="font-medium">Import complete</p>
                <p>{result.imported} imported, {result.skipped} skipped</p>
                {result.errors.map((e, i) => <p key={i} className="text-red-600">{e}</p>)}
                <p className="text-emerald-600">Redirecting to staff list…</p>
              </div>
            ) : (
              <Button onClick={handleImport} disabled={isPending || validRows.length === 0}>
                {isPending ? 'Importing...' : `Import ${validRows.length} valid row${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

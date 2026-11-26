'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { rolloverAcademicYearAction, type RolloverResult } from './rollover-actions'

type ActiveYear = { year: number; startDate: string; endDate: string } | null

/** Shifts a YYYY-MM-DD string forward by whole years, keeping month and day. */
function shiftIsoYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function RolloverForm({ activeYear }: { activeYear: ActiveYear }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RolloverResult['summary'] | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const nextYear = activeYear ? activeYear.year + 1 : new Date().getFullYear() + 1
  const [year, setYear] = useState(String(nextYear))
  const [startDate, setStartDate] = useState(activeYear ? shiftIsoYears(activeYear.startDate, 1) : '')
  const [endDate, setEndDate] = useState(activeYear ? shiftIsoYears(activeYear.endDate, 1) : '')
  const [copyClasses, setCopyClasses] = useState(true)
  const [promoteStudents, setPromoteStudents] = useState(true)

  if (!activeYear) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Academic year rollover</CardTitle>
          <CardDescription>Set an active academic year first. Rollover starts from the active year.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await rolloverAcademicYearAction(formData)
      if (res.success && res.summary) {
        setResult(res.summary)
        router.refresh()
      } else {
        setError(res.error ?? 'The rollover failed.')
      }
    })
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rollover complete</CardTitle>
          <CardDescription>{result.year} is now the active academic year.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>{result.classesCopied} class(es) copied, with {result.teacherAssignments} teacher assignment(s).</p>
          <p>{result.studentsPromoted} student(s) moved up a year level.</p>
          {result.studentsAtTopLevel > 0 && (
            <p className="text-amber-700">
              {result.studentsAtTopLevel} student(s) are in the top year level and were not promoted. Process them through exit.
            </p>
          )}
          <p className="text-slate-500">Students are not copied into the new classes. They need to enrol again.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a new academic year</CardTitle>
        <CardDescription>
          Creates the next year from the active year ({activeYear.year}) and makes it active. Term dates move forward by the same number of years.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rollover-year">Year</Label>
              <Input id="rollover-year" name="year" type="number" value={year} onChange={e => setYear(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rollover-start">Starts</Label>
              <Input id="rollover-start" name="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rollover-end">Ends</Label>
              <Input id="rollover-end" name="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700 mb-1">Options</legend>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="copyClasses"
                checked={copyClasses}
                onChange={e => setCopyClasses(e.target.checked)}
                className="mt-0.5"
              />
              <span>Copy classes and teacher assignments into the new year</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="promoteStudents"
                checked={promoteStudents}
                onChange={e => setPromoteStudents(e.target.checked)}
                className="mt-0.5"
              />
              <span>Move every active student up one year level (top year level is left unchanged)</span>
            </label>
          </fieldset>

          <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <input
              type="checkbox"
              name="confirm"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5"
              required
            />
            <span>I understand this makes {year || 'the new year'} the active year and cannot be undone automatically.</span>
          </label>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={isPending || !confirmed}>
            {isPending ? 'Rolling over…' : 'Start new academic year'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

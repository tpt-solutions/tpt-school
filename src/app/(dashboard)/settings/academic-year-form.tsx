'use client'

import { useState, useTransition } from 'react'
import { createAcademicYearAction, setActiveYearAction, createTermAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { CheckCircle, Plus, ChevronDown, ChevronRight } from 'lucide-react'

type Term = {
  id: string
  termNumber: number
  name: string
  startDate: Date
  endDate: Date
}

type AcademicYear = {
  id: string
  year: number
  startDate: Date
  endDate: Date
  active: boolean
  terms: Term[]
}

type Props = {
  years: AcademicYear[]
}

export default function AcademicYearForm({ years }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedYear, setExpandedYear] = useState<string | null>(null)
  const [addTermYear, setAddTermYear] = useState<string | null>(null)

  function handleCreateYear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)
    ;(e.currentTarget as HTMLFormElement).reset()
    startTransition(async () => {
      const result = await createAcademicYearAction(formData)
      if (result.error) setError(result.error)
      else setSuccess('Academic year created with 4 terms.')
    })
  }

  function handleSetActive(yearId: string) {
    startTransition(async () => {
      const result = await setActiveYearAction(yearId)
      if (result.error) setError(result.error)
      else setSuccess('Active year updated.')
    })
  }

  function handleAddTerm(yearId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createTermAction(yearId, formData)
      if (result.error) setError(result.error)
      else {
        setSuccess('Term added.')
        setAddTermYear(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Create Year Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Academic Year</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateYear} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  placeholder={new Date().getFullYear().toString()}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date *</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
            <p className="text-xs text-slate-500">4 terms will be auto-generated from the date range.</p>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Academic Year'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Years */}
      {years.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Academic Years</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {years.map(ay => (
                <div key={ay.id}>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedYear(expandedYear === ay.id ? null : ay.id)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {expandedYear === ay.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{ay.year}</span>
                          {ay.active && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {format(new Date(ay.startDate), 'dd MMM yyyy')} —{' '}
                          {format(new Date(ay.endDate), 'dd MMM yyyy')} &middot;{' '}
                          {ay.terms.length} terms
                        </p>
                      </div>
                    </div>
                    {!ay.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActive(ay.id)}
                        disabled={isPending}
                      >
                        Set Active
                      </Button>
                    )}
                  </div>

                  {/* Terms */}
                  {expandedYear === ay.id && (
                    <div className="bg-slate-50 px-8 pb-4">
                      <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                        Terms
                      </p>
                      <div className="space-y-2 mb-4">
                        {ay.terms.sort((a, b) => a.termNumber - b.termNumber).map(term => (
                          <div key={term.id} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{term.name}</span>
                            <span className="text-slate-500">
                              {format(new Date(term.startDate), 'dd MMM')} —{' '}
                              {format(new Date(term.endDate), 'dd MMM yyyy')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Add Term */}
                      {addTermYear === ay.id ? (
                        <form onSubmit={(e) => handleAddTerm(ay.id, e)} className="space-y-3 border border-slate-200 rounded-lg p-3 bg-white">
                          <p className="text-sm font-medium text-slate-700">Add Term</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Term Number</Label>
                              <Input name="termNumber" type="number" min="1" max="8" placeholder="5" required />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input name="name" placeholder="Term 5" required />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Start Date</Label>
                              <Input name="startDate" type="date" required />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End Date</Label>
                              <Input name="endDate" type="date" required />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={isPending}>Add</Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAddTermYear(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddTermYear(ay.id)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Term
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

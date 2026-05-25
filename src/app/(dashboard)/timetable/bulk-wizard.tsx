'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Wand2, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { bulkCreateSlotsAction } from './actions'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

type PeriodConfig = {
  period: number
  startTime: string
  endTime: string
  enabled: boolean
}

const DEFAULT_PERIODS: PeriodConfig[] = [
  { period: 1, startTime: '08:30', endTime: '09:30', enabled: true },
  { period: 2, startTime: '09:30', endTime: '10:30', enabled: true },
  { period: 3, startTime: '10:50', endTime: '11:50', enabled: true },
  { period: 4, startTime: '11:50', endTime: '12:50', enabled: true },
  { period: 5, startTime: '13:30', endTime: '14:30', enabled: true },
  { period: 6, startTime: '14:30', endTime: '15:30', enabled: true },
]

type ExistingSlot = {
  classId: string
  dayOfWeek: number
  period: number
  class: { name: string; code: string }
}

type ClassOption = { id: string; name: string; code: string }
type RoomOption = { id: string; name: string; code: string }
type StaffOption = { id: string; user: { name: string } }

type Props = {
  classes: ClassOption[]
  rooms: RoomOption[]
  staff: StaffOption[]
  existingSlots: ExistingSlot[]
}

export default function BulkWizard({ classes, rooms, staff, existingSlots }: Props) {
  const [open, setOpen] = useState(false)
  const [showPeriods, setShowPeriods] = useState(false)
  const [periods, setPeriods] = useState<PeriodConfig[]>(DEFAULT_PERIODS)
  const [classId, setClassId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  const enabledPeriods = periods.filter((p) => p.enabled)

  const existingMap = new Map<string, { classId: string; className: string }>()
  for (const slot of existingSlots) {
    existingMap.set(`${slot.dayOfWeek}-${slot.period}`, {
      classId: slot.classId,
      className: slot.class.name,
    })
  }

  function toggleCell(day: number, period: number) {
    const key = `${day}-${period}`
    const existing = existingMap.get(key)
    if (existing?.classId === classId) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function reset() {
    setClassId('')
    setStaffId('')
    setRoomId('')
    setSelected(new Set())
    setResult(null)
  }

  function addPeriod() {
    const next = periods.length + 1
    const lastEnabled = [...periods].reverse().find((p) => p.enabled)
    const startTime = lastEnabled?.endTime ?? '15:30'
    const [h, m] = startTime.split(':').map(Number)
    const endMin = h * 60 + m + 60
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
    setPeriods((prev) => [...prev, { period: next, startTime, endTime, enabled: true }])
  }

  function quickSelect(days: number[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const pc of enabledPeriods) {
        for (const day of days) {
          const key = `${day}-${pc.period}`
          const existing = existingMap.get(key)
          if (existing?.classId !== classId) next.add(key)
        }
      }
      return next
    })
  }

  async function handleCreate() {
    if (!classId || selected.size === 0) return
    setSubmitting(true)
    setResult(null)

    const slots = Array.from(selected).map((key) => {
      const [day, period] = key.split('-').map(Number)
      const pc = periods.find((p) => p.period === period)!
      return {
        classId,
        staffId: staffId || null,
        roomId: roomId || null,
        dayOfWeek: day,
        period,
        startTime: pc.startTime,
        endTime: pc.endTime,
      }
    })

    const res = await bulkCreateSlotsAction(slots)
    setResult(res)
    if (res.created > 0) setSelected(new Set())
    setSubmitting(false)
  }

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name, sublabel: c.code }))
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.user.name }))
  const roomOptions = rooms.map((r) => ({ value: r.id, label: r.name, sublabel: r.code }))

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        <Wand2 className="w-4 h-4" />
        Bulk Schedule
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) { reset(); setOpen(false) } else setOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Schedule Wizard</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Period configurator */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPeriods((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span>Configure Period Times</span>
                {showPeriods ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showPeriods && (
                <div className="p-4 space-y-2">
                  {periods.map((p, i) => (
                    <div key={p.period} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) =>
                          setPeriods((prev) =>
                            prev.map((pp, ii) => (ii === i ? { ...pp, enabled: e.target.checked } : pp)),
                          )
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm font-medium w-8 shrink-0">P{p.period}</span>
                      <Input
                        type="time"
                        value={p.startTime}
                        onChange={(e) =>
                          setPeriods((prev) =>
                            prev.map((pp, ii) => (ii === i ? { ...pp, startTime: e.target.value } : pp)),
                          )
                        }
                        className="h-7 w-32"
                        disabled={!p.enabled}
                      />
                      <span className="text-slate-400 text-sm">→</span>
                      <Input
                        type="time"
                        value={p.endTime}
                        onChange={(e) =>
                          setPeriods((prev) =>
                            prev.map((pp, ii) => (ii === i ? { ...pp, endTime: e.target.value } : pp)),
                          )
                        }
                        className="h-7 w-32"
                        disabled={!p.enabled}
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="xs" onClick={addPeriod} className="mt-2">
                    <Plus className="w-3.5 h-3.5" /> Add Period
                  </Button>
                </div>
              )}
            </div>

            {/* Class / teacher / room */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Class *</Label>
                <Combobox
                  options={classOptions}
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v)
                    setSelected(new Set())
                    setResult(null)
                  }}
                  placeholder="Select class…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teacher</Label>
                <Combobox
                  options={staffOptions}
                  value={staffId}
                  onValueChange={setStaffId}
                  placeholder="Select teacher…"
                  allowClear
                  clearLabel="None"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Room</Label>
                <Combobox
                  options={roomOptions}
                  value={roomId}
                  onValueChange={setRoomId}
                  placeholder="Select room…"
                  allowClear
                  clearLabel="None"
                />
              </div>
            </div>

            {/* Selection grid */}
            {classId && (
              <div>
                <p className="text-sm text-slate-600 mb-3">
                  Click cells to select which periods this class meets:
                </p>
                <div className="border border-border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-6 text-center text-xs font-medium bg-slate-50 border-b border-border">
                    <div className="p-2 border-r border-border text-slate-500">Period</div>
                    {DAY_NAMES.map((d, i) => (
                      <div key={d} className={cn('p-2', i < 4 && 'border-r border-border')}>
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {enabledPeriods.map((pc) => (
                    <div key={pc.period} className="grid grid-cols-6 border-b border-border last:border-b-0">
                      <div className="p-2 border-r border-border bg-slate-50 text-center">
                        <div className="text-xs font-semibold">P{pc.period}</div>
                        <div className="text-xs text-slate-400">{pc.startTime}</div>
                      </div>
                      {[1, 2, 3, 4, 5].map((day, dayIdx) => {
                        const key = `${day}-${pc.period}`
                        const isSelected = selected.has(key)
                        const existing = existingMap.get(key)
                        const isSameClass = existing?.classId === classId
                        const isOtherClass = existing && !isSameClass

                        return (
                          <div
                            key={key}
                            onClick={() => !isSameClass && toggleCell(day, pc.period)}
                            className={cn(
                              'min-h-[52px] p-1 text-xs flex items-center justify-center transition-colors',
                              dayIdx < 4 && 'border-r border-border',
                              isSameClass
                                ? 'bg-slate-100 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-slate-50',
                              isSelected && 'bg-primary/10',
                            )}
                          >
                            {isSameClass ? (
                              <span className="text-slate-400 text-center leading-tight text-[11px]">
                                Already
                                <br />
                                scheduled
                              </span>
                            ) : isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">✓</span>
                              </div>
                            ) : isOtherClass ? (
                              <span className="text-amber-600 text-center leading-tight text-[10px] px-0.5">
                                {existing.className}
                              </span>
                            ) : (
                              <div className="w-5 h-5 rounded border-2 border-slate-200" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>

                {/* Quick select */}
                <div className="flex gap-3 mt-2 flex-wrap items-center">
                  <span className="text-xs text-slate-500">Quick select:</span>
                  {[
                    { label: 'Mon / Wed / Fri', days: [1, 3, 5] },
                    { label: 'Tue / Thu', days: [2, 4] },
                    { label: 'Mon – Fri (all)', days: [1, 2, 3, 4, 5] },
                  ].map(({ label, days }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => quickSelect(days)}
                      className="text-xs text-primary underline underline-offset-2 hover:text-primary/70"
                    >
                      {label}
                    </button>
                  ))}
                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Result banner */}
            {result && (
              <div
                className={cn(
                  'rounded-lg px-4 py-3 text-sm space-y-1',
                  result.errors.length > 0 || result.skipped > 0
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-green-50 border border-green-200 text-green-800',
                )}
              >
                {result.created > 0 && (
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {result.created} slot{result.created !== 1 ? 's' : ''} created successfully.
                  </p>
                )}
                {result.skipped > 0 && !result.errors.length && (
                  <p>{result.skipped} slot{result.skipped !== 1 ? 's' : ''} skipped (already exist).</p>
                )}
                {result.errors.map((e, i) => (
                  <p key={i} className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {e}
                  </p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                reset()
                setOpen(false)
              }}
            >
              Done
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!classId || selected.size === 0 || submitting}
            >
              {submitting
                ? 'Creating…'
                : `Create ${selected.size} Slot${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

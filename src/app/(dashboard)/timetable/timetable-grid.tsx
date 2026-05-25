'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createSlotAction, updateSlotAction, deleteSlotAction } from './actions'
import { Trash2, Plus, AlertTriangle } from 'lucide-react'
import BulkWizard from './bulk-wizard'
import type { TimetableConflict } from '@/lib/timetable-conflicts'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

function defaultStartTime(period: number): string {
  const base = 8 * 60 + 30 + (period - 1) * 60
  const h = Math.floor(base / 60).toString().padStart(2, '0')
  const m = (base % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function defaultEndTime(period: number): string {
  const base = 8 * 60 + 30 + period * 60
  const h = Math.floor(base / 60).toString().padStart(2, '0')
  const m = (base % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

type Slot = {
  id: string
  classId: string
  staffId: string | null
  roomId: string | null
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  notes: string | null
  class: { name: string; code: string }
  room: { code: string } | null
  staff: { user: { name: string } } | null
}

type ClassOption = { id: string; name: string; code: string }
type RoomOption = { id: string; name: string; code: string }
type StaffOption = { id: string; user: { name: string } }

interface TimetableGridProps {
  slots: Slot[]
  classes: ClassOption[]
  rooms: RoomOption[]
  staff: StaffOption[]
  isAdmin: boolean
  conflicts?: TimetableConflict[]
}

interface EditState {
  slotId?: string
  day: number
  period: number
  classId: string
  staffId: string
  roomId: string
  startTime: string
  endTime: string
  notes: string
}

export default function TimetableGrid({ slots, classes, rooms, staff, isAdmin, conflicts = [] }: TimetableGridProps) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slotMap = new Map<string, Slot>()
  for (const slot of slots) {
    slotMap.set(`${slot.dayOfWeek}-${slot.period}`, slot)
  }

  // Build a set of day-period keys that have at least one conflict
  const conflictCells = new Set<string>()
  for (const c of conflicts) {
    conflictCells.add(`${c.day}-${c.period}`)
  }

  function openNew(day: number, period: number) {
    if (!isAdmin) return
    setError(null)
    setEditState({
      day,
      period,
      classId: '',
      staffId: '',
      roomId: '',
      startTime: defaultStartTime(period),
      endTime: defaultEndTime(period),
      notes: '',
    })
  }

  function openEdit(slot: Slot) {
    if (!isAdmin) return
    setError(null)
    setEditState({
      slotId: slot.id,
      day: slot.dayOfWeek,
      period: slot.period,
      classId: slot.classId,
      staffId: slot.staffId ?? '',
      roomId: slot.roomId ?? '',
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: slot.notes ?? '',
    })
  }

  async function handleSave() {
    if (!editState) return
    if (!editState.classId) { setError('Please select a class'); return }
    setLoading(true)
    setError(null)
    const data = {
      classId: editState.classId,
      staffId: editState.staffId || null,
      roomId: editState.roomId || null,
      dayOfWeek: editState.day,
      period: editState.period,
      startTime: editState.startTime,
      endTime: editState.endTime,
      notes: editState.notes || null,
    }
    try {
      const result = editState.slotId
        ? await updateSlotAction(editState.slotId, data)
        : await createSlotAction(data)
      if (result.error) { setError(result.error) }
      else setEditState(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!editState?.slotId) return
    setLoading(true)
    const result = await deleteSlotAction(editState.slotId)
    if (result.error) setError(result.error)
    else setEditState(null)
    setLoading(false)
  }

  return (
    <>
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <BulkWizard
            classes={classes}
            rooms={rooms}
            staff={staff}
            existingSlots={slots}
          />
        </div>
      )}

      {/* Conflict summary */}
      {conflicts.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm font-semibold text-red-700">
              {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected
            </span>
          </div>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                <span className="shrink-0 mt-0.5 rounded px-1 py-0.5 bg-red-100 text-red-500 font-medium uppercase tracking-wide text-[10px]">
                  {c.type === 'teacher-clash' ? 'Staff' : 'Room'}
                </span>
                {c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="grid grid-cols-6 min-w-[640px]">
          {/* Header row */}
          <div className="bg-slate-50 border-b border-r border-slate-200 p-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
            Period
          </div>
          {DAY_NAMES.map((day, i) => (
            <div
              key={day}
              className={`bg-slate-50 border-b border-slate-200 p-3 text-sm font-semibold text-slate-700 text-center${i < 4 ? ' border-r' : ''}`}
            >
              {day}
            </div>
          ))}

          {/* Period rows */}
          {PERIODS.map((period) => (
            <React.Fragment key={period}>
              {/* Period label */}
              <div
                className="border-b border-r border-slate-100 p-3 bg-slate-50 text-center last:border-b-0"
              >
                <div className="text-sm font-semibold text-slate-700">P{period}</div>
                <div className="text-xs text-slate-400">
                  {defaultStartTime(period)}
                </div>
              </div>

              {/* Day cells */}
              {([1, 2, 3, 4, 5] as const).map((day, dayIdx) => {
                const slot = slotMap.get(`${day}-${period}`)
                const hasConflict = conflictCells.has(`${day}-${period}`)
                return (
                  <div
                    key={`${day}-${period}`}
                    className={`border-b border-slate-100 min-h-[80px] p-1.5${dayIdx < 4 ? ' border-r' : ''}${isAdmin ? ' cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => slot ? openEdit(slot) : openNew(day, period)}
                  >
                    {slot ? (
                      <div className={`h-full rounded-lg p-2 text-xs ${hasConflict ? 'bg-red-50 border border-red-300' : 'bg-primary/10 border border-primary/20'}`}>
                        <div className={`font-semibold truncate flex items-center gap-1 ${hasConflict ? 'text-red-700' : 'text-primary'}`}>
                          {hasConflict && <AlertTriangle className="w-3 h-3 shrink-0" />}
                          {slot.class.name}
                        </div>
                        {slot.room && (
                          <div className={`font-mono mt-0.5 ${hasConflict ? 'text-red-500' : 'text-slate-500'}`}>{slot.room.code}</div>
                        )}
                        {slot.staff && (
                          <div className={`truncate mt-0.5 ${hasConflict ? 'text-red-400' : 'text-slate-400'}`}>{slot.staff.user.name}</div>
                        )}
                      </div>
                    ) : isAdmin ? (
                      <div className="h-full flex items-center justify-center text-slate-300 hover:text-slate-400 transition-colors rounded-lg hover:bg-slate-100 min-h-[64px]">
                        <Plus className="w-4 h-4" />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      {isAdmin && (
        <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editState?.slotId ? 'Edit' : 'Add'} Timetable Slot
                {editState && ` — ${DAY_NAMES[editState.day - 1]}, Period ${editState.period}`}
              </DialogTitle>
            </DialogHeader>

            {editState && (
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select
                    value={editState.classId}
                    onValueChange={(v) => setEditState({ ...editState, classId: v ?? '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select
                    value={editState.roomId}
                    onValueChange={(v) => setEditState({ ...editState, roomId: v ?? '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No room</SelectItem>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Staff</Label>
                  <Select
                    value={editState.staffId}
                    onValueChange={(v) => setEditState({ ...editState, staffId: v ?? '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No staff</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={editState.startTime}
                      onChange={(e) => setEditState({ ...editState, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={editState.endTime}
                      onChange={(e) => setEditState({ ...editState, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={editState.notes}
                    onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex-row justify-between gap-2">
              {editState?.slotId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setEditState(null)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

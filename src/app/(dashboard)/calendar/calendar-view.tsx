'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createSchoolEventAction, deleteSchoolEventAction } from './actions'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string
  allDay: boolean
  category: string
  createdBy: string
}

type Props = {
  events: CalendarEvent[]
  canEdit: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  academic:  'bg-blue-100 text-blue-800 border-blue-200',
  sports:    'bg-emerald-100 text-emerald-800 border-emerald-200',
  cultural:  'bg-purple-100 text-purple-800 border-purple-200',
  admin:     'bg-slate-100 text-slate-700 border-slate-200',
  holiday:   'bg-amber-100 text-amber-800 border-amber-200',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function CalendarView({ events, canEdit }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function eventsOnDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => {
      const start = e.startDate.slice(0, 10)
      const end = e.endDate.slice(0, 10)
      return dateStr >= start && dateStr <= end
    })
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createSchoolEventAction(fd)
      if (result.success) {
        setShowForm(false)
      } else {
        setFormError(result.error ?? 'Save failed.')
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteSchoolEventAction(id)
      setSelected(null)
    })
  }

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900 min-w-[160px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {DAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-slate-500">
              {d}
            </div>
          ))}
        </div>
        {/* Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {cells.map((day, idx) => {
            const dayEvents = day ? eventsOnDay(day) : []
            return (
              <div
                key={idx}
                className={`min-h-[80px] p-1.5 ${day ? 'hover:bg-slate-50 cursor-default' : 'bg-slate-50/40'}`}
              >
                {day && (
                  <>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1 ${
                      isToday(day)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-slate-700'
                    }`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded border truncate ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.academic}`}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(CATEGORY_COLORS).map(([cat, cls]) => (
          <span key={cat} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${cls}`}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </span>
        ))}
      </div>

      {/* Event detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2 ${CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS.academic}`}>
                  {selected.category}
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selected.description && (
              <p className="text-sm text-slate-600">{selected.description}</p>
            )}
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>Start:</strong> {new Date(selected.startDate).toLocaleDateString()}</p>
              <p><strong>End:</strong> {new Date(selected.endDate).toLocaleDateString()}</p>
              <p><strong>Added by:</strong> {selected.createdBy}</p>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(selected.id)}
                disabled={isPending}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Event
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add event form */}
      {showForm && canEdit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Add Event</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="evTitle">Title *</Label>
                <Input id="evTitle" name="title" required placeholder="e.g. Sports Day" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evDesc">Description</Label>
                <Textarea id="evDesc" name="description" rows={2} placeholder="Optional details..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="evStart">Start Date *</Label>
                  <Input id="evStart" name="startDate" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evEnd">End Date *</Label>
                  <Input id="evEnd" name="endDate" type="date" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  name="category"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="academic">Academic</option>
                  <option value="sports">Sports</option>
                  <option value="cultural">Cultural</option>
                  <option value="admin">Admin</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Visible to</Label>
                <select
                  name="targetRoles"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">Everyone</option>
                  <option value='["admin","teacher"]'>Staff only</option>
                  <option value='["parent","student"]'>Parents & Students</option>
                  <option value='["admin"]'>Admin only</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Event'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

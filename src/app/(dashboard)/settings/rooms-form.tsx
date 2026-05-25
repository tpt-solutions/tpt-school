'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Loader2, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import { createRoomAction, updateRoomAction, deleteRoomAction } from './actions'

type Room = {
  id: string
  name: string
  code: string
  type: string | null
  building: string | null
  floor: string | null
  capacity: number | null
}

type Props = { rooms: Room[] }

const ROOM_TYPES = ['Classroom', 'Laboratory', 'Hall', 'Gymnasium', 'Library', 'Workshop', 'Art Room', 'Music Room', 'Office', 'Other']

function RoomRow({ room, onEditDone }: { room: Room; onEditDone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateRoomAction(room.id, fd)
      if (result.error) { setError(result.error) }
      else { setEditing(false); onEditDone() }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteRoomAction(room.id)
      if (result.error) setError(result.error)
      else onEditDone()
    })
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input name="name" defaultValue={room.name} required className="h-7" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Code *</Label>
            <Input name="code" defaultValue={room.code} required className="h-7" placeholder="e.g. A101" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Input name="type" defaultValue={room.type ?? ''} className="h-7" list="room-types-edit" placeholder="e.g. Classroom" />
            <datalist id="room-types-edit">
              {ROOM_TYPES.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Capacity</Label>
            <Input name="capacity" type="number" min="1" defaultValue={room.capacity ?? ''} className="h-7" placeholder="e.g. 30" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Building</Label>
            <Input name="building" defaultValue={room.building ?? ''} className="h-7" placeholder="e.g. Block A" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Floor</Label>
            <Input name="floor" defaultValue={room.floor ?? ''} className="h-7" placeholder="e.g. Ground" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="xs" disabled={isPending}>
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => { setEditing(false); setError(null) }} disabled={isPending}>
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between py-3 px-1 group border-b border-slate-100 last:border-0">
      {error && <p className="text-xs text-destructive mr-2">{error}</p>}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 shrink-0">{room.code}</span>
        <span className="font-medium text-slate-900 truncate">{room.name}</span>
        {room.type && <Badge variant="secondary" className="text-xs shrink-0">{room.type}</Badge>}
        {room.building && <span className="text-xs text-slate-400 shrink-0">{room.building}{room.floor ? ` · ${room.floor}` : ''}</span>}
        {room.capacity && <span className="text-xs text-slate-400 shrink-0">Cap. {room.capacity}</span>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setEditing(true)} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" className="text-slate-400 hover:text-destructive" onClick={handleDelete} disabled={isPending} title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function RoomsForm({ rooms }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0) // force re-render list after mutations

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createRoomAction(fd)
      if (result.error) { setError(result.error) }
      else { setShowCreate(false); setKey(k => k + 1);(e.target as HTMLFormElement).reset() }
    })
  }

  return (
    <div className="space-y-6">
      {/* Room list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Rooms</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(s => !s)}>
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        </CardHeader>
        <CardContent>
          {/* Create form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="mb-4 border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
              <p className="text-sm font-medium text-slate-800">New Room</p>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input name="name" required className="h-7" placeholder="e.g. Room 101" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Code *</Label>
                  <Input name="code" required className="h-7" placeholder="e.g. A101" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Input name="type" className="h-7" list="room-types-new" placeholder="e.g. Classroom" />
                  <datalist id="room-types-new">
                    {ROOM_TYPES.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Capacity</Label>
                  <Input name="capacity" type="number" min="1" className="h-7" placeholder="e.g. 30" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Building</Label>
                  <Input name="building" className="h-7" placeholder="e.g. Block A" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Floor</Label>
                  <Input name="floor" className="h-7" placeholder="e.g. Ground" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create Room
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowCreate(false); setError(null) }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {rooms.length === 0 && !showCreate ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No rooms yet. Add rooms to assign them to classes and timetable slots.
            </div>
          ) : (
            <div key={key}>
              {rooms.map(room => (
                <RoomRow key={room.id} room={room} onEditDone={() => setKey(k => k + 1)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

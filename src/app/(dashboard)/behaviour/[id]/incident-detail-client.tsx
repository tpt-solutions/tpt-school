'use client'

import { useState, useTransition } from 'react'
import { updateIncidentAction, createSuspensionAction } from '../actions'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  incident: {
    id: string
    studentId: string
    description: string
    location: string | null
    severity: string
    witnesses: string | null
    actionTaken: string | null
    parentNotified: boolean
    followUpRequired: boolean
    followUpNotes: string | null
  }
  canSuspend: boolean
}

export default function IncidentDetailClient({ incident, canSuspend }: Props) {
  const [editing, setEditing] = useState(false)
  const [showSuspension, setShowSuspension] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Edit form state
  const [severity, setSeverity] = useState(incident.severity)
  const [location, setLocation] = useState(incident.location ?? '')

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('severity', severity)
    formData.set('location', location)
    startTransition(async () => {
      const result = await updateIncidentAction(incident.id, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Incident updated.')
        setEditing(false)
      }
    })
  }

  function handleSuspension(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('studentId', incident.studentId)
    startTransition(async () => {
      const result = await createSuspensionAction(incident.id, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Suspension recorded.')
        setShowSuspension(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { setEditing(true); setSuccessMsg(null) }}>
          Edit Incident
        </Button>
        {canSuspend && (
          <Button variant="destructive" size="sm" onClick={() => { setShowSuspension(true); setSuccessMsg(null) }}>
            Add Suspension
          </Button>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(v) => { if (v !== null) setSeverity(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={location} onValueChange={(v) => setLocation(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not specified</SelectItem>
                    <SelectItem value="classroom">Classroom</SelectItem>
                    <SelectItem value="playground">Playground</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" name="description" defaultValue={incident.description} rows={4} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="witnesses">Witnesses</Label>
              <Input id="witnesses" name="witnesses" defaultValue={incident.witnesses ?? ''} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actionTaken">Action taken</Label>
              <Textarea id="actionTaken" name="actionTaken" defaultValue={incident.actionTaken ?? ''} rows={2} />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="parentNotified" defaultChecked={incident.parentNotified} className="h-4 w-4 rounded border-slate-300" />
                Parent notified
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="followUpRequired" defaultChecked={incident.followUpRequired} className="h-4 w-4 rounded border-slate-300" />
                Follow-up required
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="followUpNotes">Follow-up notes</Label>
              <Textarea id="followUpNotes" name="followUpNotes" defaultValue={incident.followUpNotes ?? ''} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspension Dialog */}
      <Dialog open={showSuspension} onOpenChange={setShowSuspension}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Suspension</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSuspension} className="space-y-4 mt-2">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-1.5">
              <Label>Suspension Type *</Label>
              <Select name="type" defaultValue="out-of-school">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="out-of-school">Out of school</SelectItem>
                  <SelectItem value="in-school">In school</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="suspStartDate">Start Date *</Label>
                <Input id="suspStartDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suspEndDate">End Date *</Label>
                <Input id="suspEndDate" name="endDate" type="date" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suspReason">Reason *</Label>
              <Textarea id="suspReason" name="reason" rows={3} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="returnConditions">Return conditions</Label>
              <Textarea id="returnConditions" name="returnConditions" rows={2} placeholder="What must happen before the student returns..." />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="parentNotified" className="h-4 w-4 rounded border-slate-300" />
              Parent/guardian notified
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSuspension(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={isPending}>{isPending ? 'Saving...' : 'Record Suspension'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

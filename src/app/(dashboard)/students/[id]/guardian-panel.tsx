'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2, Plus, Trash2, UserPlus, Link2, Copy, Check } from 'lucide-react'
import { createAndLinkParentAction, linkExistingParentAction, unlinkParentAction } from './guardian-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Guardian = {
  parent: {
    id: string
    relationship: string | null
    occupation: string | null
    workPhone: string | null
    user: { name: string; email: string; phone: string | null }
  }
  isPrimary: boolean
}

type Props = {
  studentId: string
  guardians: Guardian[]
  isAdmin: boolean
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value || <span className="text-slate-400 font-normal">—</span>}</dd>
    </div>
  )
}

// ─── Temp Password Display ────────────────────────────────────────────────────

function TempPasswordCard({ password, name, onDone }: { password: string; name: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-emerald-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-800">Guardian Account Created</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Account created for <strong>{name}</strong>. Share the temporary password — it is only shown once.
        </p>
        <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Temporary password</p>
            <p className="font-mono text-lg font-bold tracking-wider text-slate-800 select-all">{password}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-amber-600 font-medium">Guardian must change this password after first login.</p>
        <Button type="button" className="w-full" onClick={onDone}>Done</Button>
      </CardContent>
    </Card>
  )
}

// ─── Add Guardian Form ────────────────────────────────────────────────────────

function AddGuardianForm({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ password: string; name: string } | null>(null)

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createAndLinkParentAction(studentId, fd)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.')
      } else if (result.tempPassword && result.parentName) {
        setCreatedPassword({ password: result.tempPassword, name: result.parentName })
      }
    })
  }

  function handleLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await linkExistingParentAction(studentId, fd)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.')
      } else {
        onClose()
      }
    })
  }

  if (createdPassword) {
    return <TempPasswordCard password={createdPassword.password} name={createdPassword.name} onDone={onClose} />
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-slate-800">Add Guardian</CardTitle>
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${mode === 'create' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              New account
            </button>
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${mode === 'link' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Link existing
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="g-firstName">First Name <span className="text-destructive">*</span></Label>
                <Input id="g-firstName" name="firstName" placeholder="e.g. Sarah" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input id="g-lastName" name="lastName" placeholder="e.g. Smith" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-email">Email <span className="text-destructive">*</span></Label>
                <Input id="g-email" name="email" type="email" placeholder="parent@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-phone">Mobile Phone</Label>
                <Input id="g-phone" name="phone" type="tel" placeholder="e.g. 021 123 4567" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-relationship">Relationship</Label>
                <Input id="g-relationship" name="relationship" placeholder="e.g. Mother, Father, Guardian" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-workPhone">Work Phone</Label>
                <Input id="g-workPhone" name="workPhone" type="tel" placeholder="e.g. 09 123 4567" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-occupation">Occupation</Label>
                <Input id="g-occupation" name="occupation" placeholder="e.g. Nurse" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="g-isPrimary" name="isPrimary" value="true" className="w-4 h-4 rounded" />
                <Label htmlFor="g-isPrimary" className="font-normal cursor-pointer">Set as primary guardian</Label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create &amp; Link
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLink} className="space-y-4">
            <p className="text-sm text-slate-500">Enter the email address of an existing parent account to link them to this student.</p>
            <div className="space-y-1.5">
              <Label htmlFor="g-link-email">Parent Email <span className="text-destructive">*</span></Label>
              <Input id="g-link-email" name="email" type="email" placeholder="parent@example.com" required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="g-link-isPrimary" name="isPrimary" value="true" className="w-4 h-4 rounded" />
              <Label htmlFor="g-link-isPrimary" className="font-normal cursor-pointer">Set as primary guardian</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Link Guardian
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GuardianPanel({ studentId, guardians, isAdmin }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [unlinkError, setUnlinkError] = useState<string | null>(null)

  function handleUnlink(parentId: string) {
    setUnlinkError(null)
    startTransition(async () => {
      const result = await unlinkParentAction(studentId, parentId)
      if (!result.success) setUnlinkError(result.error ?? 'Failed to unlink.')
    })
  }

  return (
    <div className="space-y-4">
      {unlinkError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {unlinkError}
        </div>
      )}

      {guardians.length === 0 && !showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
          No guardians or parents linked to this student yet.
        </div>
      )}

      {guardians.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guardians.map(({ parent, isPrimary }) => (
            <Card key={parent.id} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{parent.user.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {isPrimary && <Badge variant="default">Primary</Badge>}
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-destructive h-7 w-7 p-0"
                        onClick={() => handleUnlink(parent.id)}
                        disabled={isPending}
                        title="Unlink guardian"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Email" value={parent.user.email} />
                  <DetailRow label="Phone" value={parent.user.phone} />
                  <DetailRow label="Relationship" value={parent.relationship} />
                  <DetailRow label="Occupation" value={parent.occupation} />
                  <DetailRow label="Work Phone" value={parent.workPhone} />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAdmin && !showForm && (
        <Button type="button" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add Guardian
        </Button>
      )}

      {showForm && (
        <AddGuardianForm studentId={studentId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

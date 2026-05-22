'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createStaffAction, updateStaffAction } from './actions'
import { Loader2, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffData = {
  id: string
  employeeId: string
  jobTitle: string | null
  department: string | null
  employmentType: string
  dateHired: Date | null
  bio: string | null
  qualifications: string | null
  user: {
    name: string
    email: string
    phone: string | null
  }
}

type Props = {
  staff?: StaffData
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateInput(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date).toISOString().split('T')[0]
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(' ')
  const firstName = parts[0] ?? ''
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffForm({ staff }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ id: string; password: string } | null>(null)

  const isEdit = !!staff
  const { firstName: initialFirst, lastName: initialLast } = staff
    ? splitName(staff.user.name)
    : { firstName: '', lastName: '' }

  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [email, setEmail] = useState(staff?.user.email ?? '')
  const [phone, setPhone] = useState(staff?.user.phone ?? '')
  const [jobTitle, setJobTitle] = useState(staff?.jobTitle ?? '')
  const [department, setDepartment] = useState(staff?.department ?? '')
  const [employmentType, setEmploymentType] = useState(staff?.employmentType ?? 'full-time')
  const [dateHired, setDateHired] = useState(formatDateInput(staff?.dateHired))
  const [bio, setBio] = useState(staff?.bio ?? '')
  const [qualifications, setQualifications] = useState(staff?.qualifications ?? '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('firstName', firstName)
    fd.set('lastName', lastName)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('jobTitle', jobTitle)
    fd.set('department', department)
    fd.set('employmentType', employmentType)
    fd.set('dateHired', dateHired)
    fd.set('bio', bio)
    fd.set('qualifications', qualifications)

    startTransition(async () => {
      const result = isEdit
        ? await updateStaffAction(staff.id, fd)
        : await createStaffAction(fd)

      if (result && !result.success) {
        setError(result.error ?? 'Something went wrong.')
      } else if (result && result.success && !isEdit && 'tempPassword' in result && result.tempPassword && 'id' in result && result.id) {
        setCreatedPassword({ id: result.id as string, password: result.tempPassword as string })
      } else if (result && result.success && isEdit) {
        router.push(`/staff/${staff.id}`)
      }
    })
  }

  if (createdPassword) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Card className="border-emerald-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-slate-800">Staff Member Created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              The staff account has been created. Share the temporary password — it is only shown once.
            </p>
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Temporary password</p>
              <p className="font-mono text-lg font-bold tracking-wider text-slate-800 select-all">
                {createdPassword.password}
              </p>
            </div>
            <p className="text-xs text-amber-600 font-medium">
              Staff must change this password after first login.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(`/staff/${createdPassword.id}`)}
            >
              Go to Staff Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Personal Details */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-slate-800">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Sarah"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Johnson"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@school.ac.nz"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 021 123 4567"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employment Details */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-slate-800">Employment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Teacher"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Mathematics"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="employmentType">Employment Type</Label>
            <Select value={employmentType} onValueChange={(v) => { if (v !== null) setEmploymentType(v) }}>
              <SelectTrigger id="employmentType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dateHired">Date Hired</Label>
            <Input
              id="dateHired"
              type="date"
              value={dateHired}
              onChange={(e) => setDateHired(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="qualifications">Qualifications</Label>
            <Textarea
              id="qualifications"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="e.g. Bachelor of Education, NZQA Level 7…"
              rows={2}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bio">Bio / About</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A brief introduction about this staff member…"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add Staff Member'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

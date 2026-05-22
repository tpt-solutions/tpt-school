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
import { createStudentAction, updateStudentAction } from './actions'
import { ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentData = {
  id: string
  studentId: string
  dateOfBirth: Date | null
  gender: string | null
  address: string | null
  yearLevel: number | null
  enrollmentDate: Date
  enrollmentStatus: string
  nationality: string | null
  medicalConditions: string | null
  allergies: string | null
  medications: string | null
  doctorName: string | null
  doctorPhone: string | null
  emergencyName: string | null
  emergencyPhone: string | null
  emergencyRelation: string | null
  user: {
    name: string
    email: string
    phone: string | null
  }
}

type Props = {
  student?: StudentData
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

export default function StudentForm({ student }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ id: string; password: string } | null>(null)
  const [medicalOpen, setMedicalOpen] = useState(
    !!(student?.medicalConditions || student?.allergies || student?.medications || student?.doctorName),
  )

  const isEdit = !!student
  const { firstName: initialFirst, lastName: initialLast } = student
    ? splitName(student.user.name)
    : { firstName: '', lastName: '' }

  // Controlled state
  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [email, setEmail] = useState(student?.user.email ?? '')
  const [phone, setPhone] = useState(student?.user.phone ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(formatDateInput(student?.dateOfBirth))
  const [gender, setGender] = useState(student?.gender ?? '')
  const [yearLevel, setYearLevel] = useState(student?.yearLevel ? String(student.yearLevel) : '')
  const [nationality, setNationality] = useState(student?.nationality ?? '')
  const [address, setAddress] = useState(student?.address ?? '')
  const [enrollmentStatus, setEnrollmentStatus] = useState(student?.enrollmentStatus ?? 'active')
  const [enrollmentDate, setEnrollmentDate] = useState(formatDateInput(student?.enrollmentDate ?? new Date()))
  const [medicalConditions, setMedicalConditions] = useState(student?.medicalConditions ?? '')
  const [allergies, setAllergies] = useState(student?.allergies ?? '')
  const [medications, setMedications] = useState(student?.medications ?? '')
  const [doctorName, setDoctorName] = useState(student?.doctorName ?? '')
  const [doctorPhone, setDoctorPhone] = useState(student?.doctorPhone ?? '')
  const [emergencyName, setEmergencyName] = useState(student?.emergencyName ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(student?.emergencyPhone ?? '')
  const [emergencyRelation, setEmergencyRelation] = useState(student?.emergencyRelation ?? '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('firstName', firstName)
    fd.set('lastName', lastName)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('dateOfBirth', dateOfBirth)
    fd.set('gender', gender)
    fd.set('yearLevel', yearLevel)
    fd.set('nationality', nationality)
    fd.set('address', address)
    fd.set('enrollmentStatus', enrollmentStatus)
    fd.set('enrollmentDate', enrollmentDate)
    fd.set('medicalConditions', medicalConditions)
    fd.set('allergies', allergies)
    fd.set('medications', medications)
    fd.set('doctorName', doctorName)
    fd.set('doctorPhone', doctorPhone)
    fd.set('emergencyName', emergencyName)
    fd.set('emergencyPhone', emergencyPhone)
    fd.set('emergencyRelation', emergencyRelation)

    startTransition(async () => {
      const result = isEdit
        ? await updateStudentAction(student.id, fd)
        : await createStudentAction(fd)

      if (result && !result.success) {
        setError(result.error ?? 'Something went wrong.')
      } else if (result && result.success && !isEdit && 'tempPassword' in result && result.tempPassword && 'id' in result && result.id) {
        setCreatedPassword({ id: result.id as string, password: result.tempPassword as string })
      } else if (result && result.success && isEdit) {
        router.push(`/students/${student.id}`)
      }
    })
  }

  if (createdPassword) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Card className="border-emerald-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-slate-800">Student Created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              The student account has been created. Share the temporary password with the student — it is only shown once.
            </p>
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Temporary password</p>
              <p className="font-mono text-lg font-bold tracking-wider text-slate-800 select-all">
                {createdPassword.password}
              </p>
            </div>
            <p className="text-xs text-amber-600 font-medium">
              The student must change this password after first login.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(`/students/${createdPassword.id}`)}
            >
              Go to Student Profile
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
              placeholder="e.g. James"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Smith"
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
              placeholder="student@example.com"
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

          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={(v) => { if (v !== null) setGender(v) }}>
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer not to say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. New Zealand"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Home Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Example Street, Auckland"
            />
          </div>
        </CardContent>
      </Card>

      {/* Enrolment Details */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-slate-800">Enrolment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="yearLevel">Year Level</Label>
            <Select value={yearLevel} onValueChange={(v) => { if (v !== null) setYearLevel(v) }}>
              <SelectTrigger id="yearLevel" className="w-full">
                <SelectValue placeholder="Select year level" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 13 }, (_, i) => i + 1).map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    Year {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enrollmentStatus">Enrolment Status</Label>
            <Select value={enrollmentStatus} onValueChange={(v) => { if (v !== null) setEnrollmentStatus(v) }}>
              <SelectTrigger id="enrollmentStatus" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enrollmentDate">Enrolment Date</Label>
            <Input
              id="enrollmentDate"
              type="date"
              value={enrollmentDate}
              onChange={(e) => setEnrollmentDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-slate-800">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="emergencyName">Contact Name</Label>
            <Input
              id="emergencyName"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="e.g. Sarah Smith"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emergencyRelation">Relationship</Label>
            <Input
              id="emergencyRelation"
              value={emergencyRelation}
              onChange={(e) => setEmergencyRelation(e.target.value)}
              placeholder="e.g. Mother"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emergencyPhone">Contact Phone</Label>
            <Input
              id="emergencyPhone"
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="e.g. 021 987 6543"
            />
          </div>
        </CardContent>
      </Card>

      {/* Medical Information (collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setMedicalOpen((o) => !o)}
          className="flex items-center justify-between w-full px-6 py-4 text-left"
        >
          <span className="text-base font-semibold text-slate-800">Medical Information</span>
          {medicalOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {medicalOpen && (
          <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="medicalConditions">Medical Conditions</Label>
              <Textarea
                id="medicalConditions"
                value={medicalConditions}
                onChange={(e) => setMedicalConditions(e.target.value)}
                placeholder="List any known medical conditions…"
                rows={3}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="List any allergies (food, medication, environmental)…"
                rows={2}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="medications">Current Medications</Label>
              <Textarea
                id="medications"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="List any current medications and dosages…"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doctorName">Doctor / GP Name</Label>
              <Input
                id="doctorName"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Jane Brown"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doctorPhone">Doctor / GP Phone</Label>
              <Input
                id="doctorPhone"
                type="tel"
                value={doctorPhone}
                onChange={(e) => setDoctorPhone(e.target.value)}
                placeholder="e.g. 09 123 4567"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Enrol Student'}
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

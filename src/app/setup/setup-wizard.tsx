'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { completeSetupAction } from './actions'

type SchoolInfo = {
  name: string
  shortName: string
  address: string
  phone: string
  email: string
  schoolType: string
  currentYear: string
}

type AdminInfo = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

const STEPS = ['School Info', 'Admin Account', 'Review & Confirm']

export default function SetupWizard() {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    name: '',
    shortName: '',
    address: '',
    phone: '',
    email: '',
    schoolType: 'both',
    currentYear: new Date().getFullYear().toString(),
  })

  const [adminInfo, setAdminInfo] = useState<AdminInfo>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  function updateSchool(field: keyof SchoolInfo, value: string) {
    setSchoolInfo(prev => ({ ...prev, [field]: value }))
  }

  function updateAdmin(field: keyof AdminInfo, value: string) {
    setAdminInfo(prev => ({ ...prev, [field]: value }))
  }

  function validateStep1() {
    if (!schoolInfo.name.trim()) return 'School name is required.'
    if (!schoolInfo.currentYear || isNaN(Number(schoolInfo.currentYear))) return 'A valid year is required.'
    return null
  }

  function validateStep2() {
    if (!adminInfo.name.trim()) return 'Admin name is required.'
    if (!adminInfo.email.trim()) return 'Admin email is required.'
    if (adminInfo.password.length < 8) return 'Password must be at least 8 characters.'
    if (adminInfo.password !== adminInfo.confirmPassword) return 'Passwords do not match.'
    return null
  }

  function handleNext() {
    setError(null)
    if (step === 0) {
      const err = validateStep1()
      if (err) { setError(err); return }
    }
    if (step === 1) {
      const err = validateStep2()
      if (err) { setError(err); return }
    }
    setStep(s => s + 1)
  }

  function handleBack() {
    setError(null)
    setStep(s => s - 1)
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await completeSetupAction(schoolInfo, adminInfo)
      if (result.success) {
        window.location.href = '/dashboard'
      } else {
        setError(result.error ?? 'Setup failed. Please try again.')
        setStep(0)
      }
    })
  }

  return (
    <div>
      {/* Step indicators */}
      <div className="flex items-center justify-center mb-8 gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-primary text-primary-foreground' :
              'bg-slate-200 text-slate-500'
            }`}>
              {i < step ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 rounded-full ${i < step ? 'bg-green-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      <Card className="shadow-xl border-slate-100">
        {/* Step 1: School Info */}
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>Tell us about your school.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="school-name">School Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="school-name"
                    placeholder="e.g. Greenfield Primary School"
                    value={schoolInfo.name}
                    onChange={e => updateSchool('name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="short-name">Short Name / Abbreviation</Label>
                  <Input
                    id="short-name"
                    placeholder="e.g. GPS"
                    value={schoolInfo.shortName}
                    onChange={e => updateSchool('shortName', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="school-email">School Email</Label>
                  <Input
                    id="school-email"
                    type="email"
                    placeholder="office@school.edu"
                    value={schoolInfo.email}
                    onChange={e => updateSchool('email', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="school-phone">Phone Number</Label>
                  <Input
                    id="school-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={schoolInfo.phone}
                    onChange={e => updateSchool('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="current-year">Current Year <span className="text-red-500">*</span></Label>
                  <Input
                    id="current-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={schoolInfo.currentYear}
                    onChange={e => updateSchool('currentYear', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="school-type">School Type</Label>
                  <Select value={schoolInfo.schoolType} onValueChange={v => v != null && updateSchool('schoolType', v)}>
                    <SelectTrigger id="school-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="both">Primary &amp; Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="school-address">Address</Label>
                  <Input
                    id="school-address"
                    placeholder="123 School Road, City"
                    value={schoolInfo.address}
                    onChange={e => updateSchool('address', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Admin Account */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Administrator Account</CardTitle>
              <CardDescription>Create the main admin account for your school.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-name">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="admin-name"
                    placeholder="Jane Smith"
                    value={adminInfo.name}
                    onChange={e => updateAdmin('name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">Email Address <span className="text-red-500">*</span></Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@school.edu"
                    value={adminInfo.email}
                    onChange={e => updateAdmin('email', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Password <span className="text-red-500">*</span></Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={adminInfo.password}
                    onChange={e => updateAdmin('password', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-confirm">Confirm Password <span className="text-red-500">*</span></Label>
                  <Input
                    id="admin-confirm"
                    type="password"
                    placeholder="Repeat password"
                    value={adminInfo.confirmPassword}
                    onChange={e => updateAdmin('confirmPassword', e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You can add more staff and configure additional settings after setup.
              </p>
            </CardContent>
          </>
        )}

        {/* Step 3: Review */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Review &amp; Confirm</CardTitle>
              <CardDescription>Check everything looks right before finishing setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">School Details</h3>
                <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
                  {[
                    ['School Name', schoolInfo.name],
                    ['Short Name', schoolInfo.shortName || '—'],
                    ['Email', schoolInfo.email || '—'],
                    ['Phone', schoolInfo.phone || '—'],
                    ['Address', schoolInfo.address || '—'],
                    ['School Type', schoolInfo.schoolType === 'both' ? 'Primary & Secondary' : schoolInfo.schoolType.charAt(0).toUpperCase() + schoolInfo.schoolType.slice(1)],
                    ['Current Year', schoolInfo.currentYear],
                  ].map(([label, value]) => (
                    <div key={label} className="flex px-4 py-2.5 bg-white even:bg-slate-50/50 text-sm">
                      <dt className="w-36 font-medium text-slate-500 flex-shrink-0">{label}</dt>
                      <dd className="text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Administrator Account</h3>
                <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
                  {[
                    ['Name', adminInfo.name],
                    ['Email', adminInfo.email],
                    ['Password', '••••••••'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex px-4 py-2.5 bg-white even:bg-slate-50/50 text-sm">
                      <dt className="w-36 font-medium text-slate-500 flex-shrink-0">{label}</dt>
                      <dd className="text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </CardContent>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center px-6 pb-6 pt-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0 || isPending}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Setting up…
                </span>
              ) : 'Complete Setup'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

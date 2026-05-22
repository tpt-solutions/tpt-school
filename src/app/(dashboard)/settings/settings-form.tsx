'use client'

import { useState, useTransition } from 'react'
import { updateSchoolSettingsAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Settings = {
  name: string
  shortName: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  schoolType: string | null
  timezone: string | null
  currencyCode: string | null
  currencySymbol: string | null
}

type Props = {
  settings: Settings
}

const TIMEZONES = [
  'UTC', 'Pacific/Auckland', 'Australia/Sydney', 'Asia/Singapore',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Dubai',
]

export default function SettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [schoolType, setSchoolType] = useState(settings.schoolType ?? '')
  const [timezone, setTimezone] = useState(settings.timezone ?? 'UTC')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    formData.set('schoolType', schoolType)
    formData.set('timezone', timezone)

    startTransition(async () => {
      const result = await updateSchoolSettingsAction(formData)
      if (result.error) setError(result.error)
      else setSuccess(true)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Settings saved successfully.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">School Name *</Label>
              <Input id="name" name="name" defaultValue={settings.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortName">Short Name</Label>
              <Input id="shortName" name="shortName" defaultValue={settings.shortName ?? ''} placeholder="e.g. TPT" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={settings.address ?? ''} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={settings.phone ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">School Email</Label>
              <Input id="email" name="email" type="email" defaultValue={settings.email ?? ''} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" defaultValue={settings.website ?? ''} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label>School Type</Label>
              <Select value={schoolType} onValueChange={(v) => { if (v !== null) setSchoolType(v) }} name="schoolType">
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="combined">Combined (Y1-13)</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(v) => { if (v !== null) setTimezone(v) }} name="timezone">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currencyCode">Currency Code</Label>
              <Input
                id="currencyCode"
                name="currencyCode"
                defaultValue={settings.currencyCode ?? 'USD'}
                placeholder="USD"
                maxLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currencySymbol">Currency Symbol</Label>
              <Input
                id="currencySymbol"
                name="currencySymbol"
                defaultValue={settings.currencySymbol ?? '$'}
                placeholder="$"
                maxLength={5}
              />
            </div>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

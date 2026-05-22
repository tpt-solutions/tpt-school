'use client'

import { useState, useTransition } from 'react'
import { updateSmtpAction, testSmtpAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SmtpSettings = {
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpFrom: string | null
}

type Props = {
  settings: SmtpSettings
  adminEmail: string
}

export default function SmtpForm({ settings, adminEmail }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isTestPending, startTestTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState(adminEmail)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateSmtpAction(formData)
      if (result.error) setError(result.error)
      else setSuccess('SMTP settings saved.')
    })
  }

  function handleTest() {
    setError(null)
    setSuccess(null)
    startTestTransition(async () => {
      const result = await testSmtpAction(testEmail)
      if (result.error) setError(result.error)
      else setSuccess(`Test email sent to ${testEmail}`)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email (SMTP) Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                name="smtpHost"
                defaultValue={settings.smtpHost ?? ''}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                name="smtpPort"
                type="number"
                defaultValue={settings.smtpPort ?? 587}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="smtpUser">Username</Label>
              <Input
                id="smtpUser"
                name="smtpUser"
                defaultValue={settings.smtpUser ?? ''}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpPass">Password</Label>
              <Input
                id="smtpPass"
                name="smtpPass"
                type="password"
                defaultValue=""
                placeholder="Leave blank to keep existing"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtpFrom">From Address</Label>
            <Input
              id="smtpFrom"
              name="smtpFrom"
              type="email"
              defaultValue={settings.smtpFrom ?? ''}
              placeholder="noreply@yourschool.com"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save SMTP Settings'}
            </Button>
          </div>
        </form>

        {/* Test Email */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-700 mb-3">Send Test Email</p>
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="testEmail">Send to</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isTestPending || !testEmail}
            >
              {isTestPending ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { updateEmailProviderAction, testSmtpAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  emailProvider: string
  adminEmail: string
}

const PROVIDER_LABELS: Record<string, string> = {
  smtp: 'SMTP (custom server)',
  resend: 'Resend',
  mailjet: 'Mailjet',
  sendgrid: 'SendGrid',
}

export default function EmailProviderForm({ emailProvider: initial, adminEmail }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isTestPending, startTestTransition] = useTransition()
  const [provider, setProvider] = useState(initial || 'smtp')
  const [testEmail, setTestEmail] = useState(adminEmail)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const fd = new FormData(e.currentTarget)
    fd.set('emailProvider', provider)
    startTransition(async () => {
      const result = await updateEmailProviderAction(fd)
      if (result.error) setError(result.error)
      else setSuccess('Email provider settings saved.')
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
        <CardTitle>Email Provider</CardTitle>
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

          <div className="space-y-1.5">
            <Label>Email Provider</Label>
            <Select value={provider} onValueChange={v => { if (v !== null) setProvider(v) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {provider === 'smtp' && 'Use your own SMTP server. Configure credentials in the SMTP tab.'}
              {provider === 'resend' && 'Resend — modern transactional email. Get an API key at resend.com.'}
              {provider === 'mailjet' && 'Mailjet — reliable transactional email. Get keys at mailjet.com.'}
              {provider === 'sendgrid' && 'SendGrid — enterprise email delivery. Get an API key at sendgrid.com.'}
            </p>
          </div>

          {provider === 'resend' && (
            <div className="space-y-1.5">
              <Label htmlFor="resendApiKey">Resend API Key</Label>
              <Input
                id="resendApiKey"
                name="resendApiKey"
                type="password"
                placeholder="re_••••••••••••••••••"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500">Leave blank to keep existing key.</p>
            </div>
          )}

          {provider === 'mailjet' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mailjetApiKey">Mailjet API Key</Label>
                <Input
                  id="mailjetApiKey"
                  name="mailjetApiKey"
                  type="password"
                  placeholder="API key"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mailjetSecret">Mailjet Secret Key</Label>
                <Input
                  id="mailjetSecret"
                  name="mailjetSecret"
                  type="password"
                  placeholder="Secret key"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-slate-500 sm:col-span-2">Leave blank to keep existing keys.</p>
            </div>
          )}

          {provider === 'sendgrid' && (
            <div className="space-y-1.5">
              <Label htmlFor="sendgridApiKey">SendGrid API Key</Label>
              <Input
                id="sendgridApiKey"
                name="sendgridApiKey"
                type="password"
                placeholder="SG.••••••••••••••••••"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500">Leave blank to keep existing key.</p>
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Provider Settings'}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-700 mb-3">Send Test Email</p>
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="testEmailEp">Send to</Label>
              <Input
                id="testEmailEp"
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

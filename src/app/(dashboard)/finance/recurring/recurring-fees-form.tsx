'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCents } from '@/lib/money'
import { generateRecurringFeesAction, previewRecurringFeesAction, type RecurringPreview } from './actions'

type TermOption = { id: string; name: string }

export default function RecurringFeesForm({ terms, currencySymbol }: { terms: TermOption[]; currencySymbol: string }) {
  const [termId, setTermId] = useState(terms[0]?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  const [preview, setPreview] = useState<RecurringPreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function changeTerm(id: string) {
    setTermId(id)
    setPreview(null)
    setConfirmed(false)
  }

  function runPreview() {
    setMessage(null)
    startTransition(async () => {
      const res = await previewRecurringFeesAction(termId)
      if (res.success && res.preview) {
        setPreview(res.preview)
        setConfirmed(false)
      } else {
        setPreview(null)
        setMessage({ kind: 'error', text: res.error ?? 'Preview failed.' })
      }
    })
  }

  function runGenerate() {
    setMessage(null)
    startTransition(async () => {
      const res = await generateRecurringFeesAction({ termId, dueDate, confirmed })
      if (res.success) {
        setMessage({
          kind: 'ok',
          text: `${res.created ?? 0} invoice(s) created.${res.skippedNoEmail ? ` ${res.skippedNoEmail} had no parent email, so no notice was queued.` : ''}`,
        })
        setPreview(null)
        setConfirmed(false)
      } else {
        setMessage({ kind: 'error', text: res.error ?? 'Generation failed.' })
      }
    })
  }

  if (terms.length === 0) {
    return <p className="text-sm text-slate-500">Set an active academic year with terms before generating fees.</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate term fees</CardTitle>
        <CardDescription>
          Bills every active student for the fee types that apply to the term. Preview first. Running it again for the same term does not bill a fee twice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="recurring-term">Term</Label>
            <select
              id="recurring-term"
              value={termId}
              onChange={e => changeTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recurring-due">Due date</Label>
            <Input id="recurring-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        <Button type="button" variant="outline" onClick={runPreview} disabled={isPending || !termId}>
          Preview
        </Button>

        {preview && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
            <p className="font-medium text-slate-900">
              {preview.invoiceCount} invoice(s) for {preview.termName}, total {formatCents(preview.totalCents, currencySymbol)}.
            </p>
            <p className="text-slate-600">{preview.alreadyBilled} fee(s) already billed for this term and skipped.</p>
            {preview.feeTypes.length > 0 && (
              <ul className="list-disc pl-5 text-slate-600">
                {preview.feeTypes.map(f => (
                  <li key={f.name}>
                    {f.name}: {formatCents(f.amountCents, currencySymbol)} ({f.frequency}
                    {f.yearLevel != null ? `, Year ${f.yearLevel}` : ', all years'})
                  </li>
                ))}
              </ul>
            )}
            {preview.feeTypes.length === 0 && (
              <p className="text-slate-600">No active fee types apply to this term. Add them under Fee Types.</p>
            )}
            {preview.sample.length > 0 && (
              <p className="text-xs text-slate-500">
                Examples: {preview.sample.map(s => `${s.studentName} (${formatCents(s.totalCents, currencySymbol)})`).join(', ')}
              </p>
            )}

            {preview.invoiceCount > 0 && (
              <>
                <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                  <span>I have checked the preview. Create these invoices and queue an email to each parent.</span>
                </label>
                <Button type="button" onClick={runGenerate} disabled={isPending || !confirmed || !dueDate}>
                  {isPending ? 'Creating…' : 'Create invoices'}
                </Button>
                {!dueDate && <p className="text-xs text-slate-500">Enter a due date first.</p>}
              </>
            )}
          </div>
        )}

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-red-600' : 'text-sm text-emerald-700'}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

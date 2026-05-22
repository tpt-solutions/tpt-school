'use client'

import { useState, useTransition } from 'react'
import { recordPaymentAction } from '../../actions'
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
import { format } from 'date-fns'

type LineItem = {
  id: string
  description: string
  amount: number
}

type Payment = {
  id: string
  amount: number
  method: string
  reference: string | null
  paidAt: Date
}

type Props = {
  invoice: {
    id: string
    status: string
    totalAmount: number
    paidAmount: number | null
    dueDate: Date
    issueDate: Date
    notes: string | null
    studentName: string
    studentId: string
    items: LineItem[]
    payments: Payment[]
  }
  currencySymbol: string
}

const STATUS_STYLES: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  waived: 'bg-slate-100 text-slate-500',
}

function fmtCurrency(amount: number, symbol: string) {
  return `${symbol}${amount.toFixed(2)}`
}

export default function InvoiceDetailClient({ invoice, currencySymbol }: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const balance = invoice.totalAmount - (invoice.paidAmount ?? 0)

  function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountNum = parseFloat(amount)
    startTransition(async () => {
      const result = await recordPaymentAction(
        invoice.id,
        amountNum,
        method,
        reference,
        notes,
      )
      if (result.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Payment recorded successfully.')
        setShowPayment(false)
        setAmount('')
        setReference('')
        setNotes('')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {successMsg && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">Invoice for</p>
            <CardTitle className="text-xl">{invoice.studentName}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Student ID: {invoice.studentId}</p>
          </div>
          <div className="text-right">
            <span
              className={`text-sm font-medium px-3 py-1.5 rounded-full capitalize ${
                STATUS_STYLES[invoice.status] ?? 'bg-slate-100 text-slate-500'
              }`}
            >
              {invoice.status}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              Issued: {format(new Date(invoice.issueDate), 'dd MMM yyyy')}
            </p>
            <p className="text-xs text-slate-500">
              Due: {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg text-center">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total</p>
              <p className="font-bold text-slate-900">
                {fmtCurrency(invoice.totalAmount, currencySymbol)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Paid</p>
              <p className="font-bold text-green-700">
                {fmtCurrency(invoice.paidAmount ?? 0, currencySymbol)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Balance</p>
              <p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {fmtCurrency(balance, currencySymbol)}
              </p>
            </div>
          </div>
          {invoice.notes && (
            <p className="text-sm text-slate-500 mt-3 italic">{invoice.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-700">{item.description}</td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {fmtCurrency(item.amount, currencySymbol)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-slate-900">Total</td>
                <td className="px-4 py-3 text-right text-slate-900">
                  {fmtCurrency(invoice.totalAmount, currencySymbol)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payment History</CardTitle>
          {invoice.status !== 'paid' && invoice.status !== 'waived' && (
            <Button size="sm" onClick={() => setShowPayment(true)}>
              Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No payments recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left py-2 font-medium text-slate-600">Method</th>
                  <th className="text-left py-2 font-medium text-slate-600">Reference</th>
                  <th className="text-right py-2 font-medium text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.payments.map(p => (
                  <tr key={p.id}>
                    <td className="py-2.5 text-slate-600">
                      {format(new Date(p.paidAt), 'dd MMM yyyy')}
                    </td>
                    <td className="py-2.5 text-slate-600 capitalize">{p.method}</td>
                    <td className="py-2.5 text-slate-500">{p.reference ?? '—'}</td>
                    <td className="py-2.5 text-right text-green-700 font-medium">
                      {fmtCurrency(p.amount, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4 mt-2">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="payAmount">Amount ({currencySymbol}) *</Label>
              <Input
                id="payAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Balance: ${fmtCurrency(balance, currencySymbol)}`}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select value={method} onValueChange={(v) => { if (v !== null) setMethod(v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payRef">Reference (optional)</Label>
              <Input
                id="payRef"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Transaction reference, receipt no..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payNotes">Notes (optional)</Label>
              <Textarea
                id="payNotes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPayment(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

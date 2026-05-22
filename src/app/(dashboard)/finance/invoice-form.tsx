'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from './actions'
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
import { Plus, Trash2 } from 'lucide-react'

type Student = {
  id: string
  name: string
  studentId: string
}

type FeeTypeOption = {
  id: string
  name: string
  amount: number
}

type LineItem = {
  description: string
  amount: string
  feeTypeId: string
}

type Props = {
  students: Student[]
  feeTypes: FeeTypeOption[]
  currencySymbol: string
}

export default function InvoiceForm({ students, feeTypes, currencySymbol }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [studentId, setStudentId] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { description: '', amount: '', feeTypeId: '' },
  ])

  const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)

  function addItem() {
    setItems(prev => [...prev, { description: '', amount: '', feeTypeId: '' }])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      // Auto-fill amount when fee type selected
      if (field === 'feeTypeId' && value) {
        const ft = feeTypes.find(f => f.id === value)
        if (ft) {
          next[index].amount = ft.amount.toString()
          if (!next[index].description) next[index].description = ft.name
        }
      }
      return next
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('studentId', studentId)
    // Clear and re-add line items from state
    items.forEach(item => {
      formData.append('itemDescription', item.description)
      formData.append('itemAmount', item.amount)
      formData.append('itemFeeTypeId', item.feeTypeId)
    })

    startTransition(async () => {
      const result = await createInvoiceAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>New Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Student + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Student *</Label>
              <Select value={studentId} onValueChange={(v) => { if (v !== null) setStudentId(v) }} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.studentId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input id="dueDate" name="dueDate" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Any additional notes..." />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {i === 0 && <Label className="text-xs text-slate-500">Description</Label>}
                    <Input
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      placeholder="Description"
                      required
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {i === 0 && <Label className="text-xs text-slate-500">Fee Type</Label>}
                    <Select
                      value={item.feeTypeId}
                      onValueChange={v => updateItem(i, 'feeTypeId', v ?? '')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {feeTypes.map(ft => (
                          <SelectItem key={ft.id} value={ft.id}>
                            {ft.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    {i === 0 && <Label className="text-xs text-slate-500">Amount ({currencySymbol})</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount}
                      onChange={e => updateItem(i, 'amount', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(i)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <div className="text-right">
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-xl font-bold text-slate-900">
                  {currencySymbol}{total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending || !studentId}>
              {isPending ? 'Creating...' : 'Create Invoice'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

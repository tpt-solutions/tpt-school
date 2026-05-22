'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createNoticeAction } from './actions'
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

const YEAR_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

const ROLE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'parent', label: 'Parents' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
]

export default function NoticeForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState('general')
  const [pinned, setPinned] = useState(false)
  const [targetRoles, setTargetRoles] = useState<string[]>(['all'])
  const [targetYears, setTargetYears] = useState<string[]>(['all'])

  const todayStr = new Date().toISOString().split('T')[0]

  function toggleRole(value: string) {
    if (value === 'all') {
      setTargetRoles(['all'])
      return
    }
    setTargetRoles(prev => {
      const withoutAll = prev.filter(r => r !== 'all')
      return withoutAll.includes(value)
        ? withoutAll.filter(r => r !== value)
        : [...withoutAll, value]
    })
  }

  function toggleYear(value: string) {
    if (value === 'all') {
      setTargetYears(['all'])
      return
    }
    setTargetYears(prev => {
      const withoutAll = prev.filter(y => y !== 'all')
      return withoutAll.includes(value)
        ? withoutAll.filter(y => y !== value)
        : [...withoutAll, value]
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    // Inject controlled state
    formData.delete('targetRoles')
    formData.delete('targetYears')
    targetRoles.forEach(r => formData.append('targetRoles', r))
    targetYears.forEach(y => formData.append('targetYears', y))
    formData.set('pinned', pinned ? 'true' : 'false')

    startTransition(async () => {
      const result = await createNoticeAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Post New Notice</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" placeholder="Notice title" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Body *</Label>
            <Textarea
              id="body"
              name="body"
              rows={6}
              placeholder="Write the notice content here..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => { if (v !== null) setCategory(v) }} name="category">
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="publishedAt">Publish Date</Label>
              <Input
                id="publishedAt"
                name="publishedAt"
                type="date"
                defaultValue={todayStr}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expiresAt">Expiry Date (optional)</Label>
            <Input id="expiresAt" name="expiresAt" type="date" />
          </div>

          {/* Target Roles */}
          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleRole(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    targetRoles.includes(opt.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Years */}
          <div className="space-y-2">
            <Label>Year Levels</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleYear('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  targetYears.includes('all')
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                All Years
              </button>
              {YEAR_LEVELS.map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => toggleYear(String(y))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    targetYears.includes(String(y))
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Y{y}
                </button>
              ))}
            </div>
          </div>

          {/* Pinned */}
          <div className="flex items-center gap-2">
            <input
              id="pinned"
              type="checkbox"
              checked={pinned}
              onChange={e => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary"
            />
            <Label htmlFor="pinned" className="cursor-pointer">Pin this notice to the top</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Posting...' : 'Post Notice'}
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

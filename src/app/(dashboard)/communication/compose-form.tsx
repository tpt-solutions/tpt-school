'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sendMessageAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type UserOption = {
  id: string
  name: string
  email: string
  role: string
}

type Props = {
  users: UserOption[]
}

export default function ComposeForm({ users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserOption | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = search.length > 0
    ? users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectUser(user: UserOption) {
    setSelected(user)
    setSearch(user.name)
    setShowDropdown(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selected) {
      setError('Please select a recipient.')
      return
    }
    startTransition(async () => {
      const result = await sendMessageAction(selected.id, subject, body)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/communication/messages/${result.id}`)
      }
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New Message</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* To field */}
          <div className="space-y-1.5">
            <Label htmlFor="to">To *</Label>
            <div className="relative" ref={dropdownRef}>
              <Input
                id="to"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setSelected(null)
                  setShowDropdown(true)
                }}
                onFocus={() => search.length > 0 && setShowDropdown(true)}
                placeholder="Search by name or email..."
                autoComplete="off"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filtered.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => selectUser(u)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email} &middot; <span className="capitalize">{u.role}</span></p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <p className="text-xs text-emerald-600">
                Sending to: {selected.name} ({selected.email})
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Message subject"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              placeholder="Write your message here..."
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending || !selected}>
              {isPending ? 'Sending...' : 'Send Message'}
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

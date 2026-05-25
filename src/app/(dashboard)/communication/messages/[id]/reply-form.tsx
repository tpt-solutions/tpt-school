'use client'

import { useState } from 'react'
import { sendReplyAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

export default function ReplyForm({ threadId }: { threadId: string }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError(null)
    const result = await sendReplyAction(threadId, body)
    setSending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setBody('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Write a reply…"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        className="resize-none"
        disabled={sending}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && <p className="text-sm text-green-600">Reply sent.</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={sending || !body.trim()} className="gap-2">
          <Send className="w-4 h-4" />
          {sending ? 'Sending…' : 'Send Reply'}
        </Button>
      </div>
    </form>
  )
}

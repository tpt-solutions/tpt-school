'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { publishReportCardsAction } from './actions'
import { Sparkles, Send } from 'lucide-react'

type Props = {
  termId: string
  aiEnabled: boolean
  aiMode: string
}

export default function PublishReportCards({ termId, aiEnabled, aiMode }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handlePublish() {
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await publishReportCardsAction(termId)
      if (res.success) {
        const aiNote = res.generated > 0 ? ` AI generated ${res.generated} comment(s).` : ''
        setResult(`Report cards published and parent emails sent.${aiNote}`)
      } else {
        setError(res.error ?? 'Publish failed.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-800">Publish report cards for this term</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Marks all report cards as published and notifies parents.
          {aiEnabled && aiMode === 'auto' && ' AI will generate comments for students with none.'}
        </p>
        {result && <p className="text-xs text-emerald-600 mt-1 font-medium">{result}</p>}
        {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
      </div>
      <Button
        onClick={handlePublish}
        disabled={isPending}
        className="gap-1.5 shrink-0"
      >
        {aiEnabled && aiMode === 'auto'
          ? <Sparkles className="w-4 h-4" />
          : <Send className="w-4 h-4" />
        }
        {isPending ? 'Publishing...' : 'Publish All'}
      </Button>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { updateAiProviderAction, testAiConnectionAction } from './actions'
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
  aiProvider: string
  aiModel: string | null
  aiBaseUrl: string | null
  aiReportMode: string
}

const PROVIDER_NOTES: Record<string, string> = {
  none: 'AI features are disabled.',
  anthropic: 'Uses the Anthropic Claude API. Get an API key at console.anthropic.com.',
  openrouter: 'OpenRouter — access 100+ models with a single key. Get one at openrouter.ai.',
  local: 'Local model via Ollama or any OpenAI-compatible endpoint (no API key needed).',
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openrouter: 'meta-llama/llama-3.1-8b-instruct',
  local: 'llama3',
}

const DEFAULT_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  local: 'http://localhost:11434/v1',
}

export default function AiForm({ aiProvider: initial, aiModel, aiBaseUrl, aiReportMode: initialMode }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isTestPending, startTestTransition] = useTransition()
  const [provider, setProvider] = useState(initial || 'none')
  const [mode, setMode] = useState(initialMode || 'assist')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setTestResult(null)
    const fd = new FormData(e.currentTarget)
    fd.set('aiProvider', provider)
    fd.set('aiReportMode', mode)
    startTransition(async () => {
      const result = await updateAiProviderAction(fd)
      if (result.error) setError(result.error)
      else setSuccess('AI settings saved.')
    })
  }

  function handleTest() {
    setError(null)
    setSuccess(null)
    setTestResult(null)
    startTestTransition(async () => {
      const result = await testAiConnectionAction()
      if (result.success) setTestResult('Connection successful! AI is working.')
      else setError(result.error ?? 'Connection failed.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Integration</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {(success || testResult) && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success ?? testResult}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>AI Provider</Label>
            <Select value={provider} onValueChange={v => { if (v !== null) setProvider(v) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (disabled)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="local">Local / Ollama</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{PROVIDER_NOTES[provider]}</p>
          </div>

          {provider !== 'none' && (
            <>
              {provider !== 'local' && (
                <div className="space-y-1.5">
                  <Label htmlFor="aiApiKey">API Key</Label>
                  <Input
                    id="aiApiKey"
                    name="aiApiKey"
                    type="password"
                    placeholder="Leave blank to keep existing key"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="aiModel">Model</Label>
                <Input
                  id="aiModel"
                  name="aiModel"
                  defaultValue={aiModel ?? DEFAULT_MODELS[provider] ?? ''}
                  placeholder={DEFAULT_MODELS[provider] ?? 'model name'}
                />
                <p className="text-xs text-slate-500">
                  {provider === 'anthropic' && 'e.g. claude-sonnet-4-6, claude-haiku-4-5-20251001'}
                  {provider === 'openrouter' && 'e.g. meta-llama/llama-3.1-8b-instruct, openai/gpt-4o'}
                  {provider === 'local' && 'e.g. llama3, mistral, phi3'}
                </p>
              </div>

              {(provider === 'openrouter' || provider === 'local') && (
                <div className="space-y-1.5">
                  <Label htmlFor="aiBaseUrl">API Base URL</Label>
                  <Input
                    id="aiBaseUrl"
                    name="aiBaseUrl"
                    defaultValue={aiBaseUrl ?? DEFAULT_URLS[provider] ?? ''}
                    placeholder={DEFAULT_URLS[provider] ?? 'http://localhost:11434/v1'}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Report Card Mode</Label>
                <Select value={mode} onValueChange={v => { if (v !== null) setMode(v) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assist">Assist — suggest comment, teacher reviews</SelectItem>
                    <SelectItem value="auto">Auto — generate and save on publish</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  {mode === 'assist'
                    ? 'A "Generate with AI" button appears on each report card. Teachers can edit before saving.'
                    : 'When publishing report cards, AI will auto-generate comments for students with no existing comment.'}
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save AI Settings'}
            </Button>
            {provider !== 'none' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={isTestPending}
              >
                {isTestPending ? 'Testing...' : 'Test Connection'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

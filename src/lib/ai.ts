import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export type ReportCardContext = {
  studentName: string
  yearLevel: number | null
  termName: string
  classes: Array<{
    name: string
    teacher: string
    letterGrade: string | null
    averageScore: number | null
  }>
  attendanceRate: number
  absenceCount: number
  behaviourIncidentCount: number
  behaviourSeverities: string[]
}

const SYSTEM_PROMPT =
  'You are a professional school teacher writing a report card comment. Write in a warm, constructive tone. Be specific to the data provided. Keep it to 2-3 sentences. Do not use the student\'s last name. Focus on strengths and areas for growth.'

export async function generateReportComment(context: ReportCardContext): Promise<string> {
  const settings = await db.schoolSettings.findFirst()
  if (!settings || settings.aiProvider === 'none') {
    throw new Error('AI provider not configured.')
  }

  const apiKey = decrypt(settings.aiApiKey ?? '')
  const model = settings.aiModel || getDefaultModel(settings.aiProvider)
  const baseUrl = settings.aiBaseUrl || getDefaultBaseUrl(settings.aiProvider)

  const userMessage = buildPrompt(context)

  if (settings.aiProvider === 'anthropic') {
    return callAnthropic(apiKey, model, userMessage)
  }
  // OpenRouter and local (Ollama) both use OpenAI-compatible chat completions
  return callOpenAICompat(apiKey, model, baseUrl, userMessage, settings.aiProvider)
}

function getDefaultModel(provider: string): string {
  if (provider === 'anthropic') return 'claude-sonnet-4-6'
  if (provider === 'openrouter') return 'meta-llama/llama-3.1-8b-instruct'
  return 'llama3'
}

function getDefaultBaseUrl(provider: string): string {
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1'
  if (provider === 'local') return 'http://localhost:11434/v1'
  return ''
}

function buildPrompt(ctx: ReportCardContext): string {
  const classLines = ctx.classes
    .map(c => {
      const grade = c.letterGrade ? ` (${c.letterGrade})` : c.averageScore != null ? ` (${c.averageScore.toFixed(0)}%)` : ''
      return `- ${c.name}${grade}`
    })
    .join('\n')

  const behaviourNote =
    ctx.behaviourIncidentCount > 0
      ? `\nBehaviour: ${ctx.behaviourIncidentCount} incident(s) recorded this term.`
      : ''

  return `Write a report card comment for the following student.

Student: ${ctx.studentName}
Year Level: ${ctx.yearLevel ?? 'N/A'}
Term: ${ctx.termName}
Attendance: ${ctx.attendanceRate.toFixed(1)}% (${ctx.absenceCount} absence(s))
${behaviourNote}
Classes:
${classLines}

Write the comment now:`
}

async function callAnthropic(apiKey: string, model: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${err}`)
  }

  const data = await res.json()
  const content = data.content?.[0]
  if (content?.type === 'text') return content.text.trim()
  throw new Error('Unexpected response format from Anthropic.')
}

async function callOpenAICompat(
  apiKey: string,
  model: string,
  baseUrl: string,
  userMessage: string,
  provider: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://tpt-school'
    headers['X-Title'] = 'TPT School'
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${provider} API error: ${err}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (typeof text === 'string') return text.trim()
  throw new Error(`Unexpected response format from ${provider}.`)
}

export async function testAiConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await db.schoolSettings.findFirst()
    if (!settings || settings.aiProvider === 'none') {
      return { success: false, error: 'No AI provider configured.' }
    }
    const apiKey = decrypt(settings.aiApiKey ?? '')
    const model = settings.aiModel || getDefaultModel(settings.aiProvider)
    const baseUrl = settings.aiBaseUrl || getDefaultBaseUrl(settings.aiProvider)
    const testCtx: ReportCardContext = {
      studentName: 'Test Student',
      yearLevel: 9,
      termName: 'Term 1',
      classes: [{ name: 'Mathematics', teacher: 'Mr Smith', letterGrade: 'B', averageScore: 75 }],
      attendanceRate: 95,
      absenceCount: 2,
      behaviourIncidentCount: 0,
      behaviourSeverities: [],
    }
    if (settings.aiProvider === 'anthropic') {
      await callAnthropic(apiKey, model, buildPrompt(testCtx))
    } else {
      await callOpenAICompat(apiKey, model, baseUrl, buildPrompt(testCtx), settings.aiProvider)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection test failed.' }
  }
}

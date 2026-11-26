import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type OnboardingCounts = {
  academicYears: number
  terms: number
  staff: number
  classes: number
  students: number
  feeTypes: number
  smtpConfigured: boolean
}

// Each step is required unless marked optional. The card is hidden once all required steps are done.
export function buildOnboardingSteps(c: OnboardingCounts) {
  return [
    { label: 'Create an academic year and terms', href: '/settings', done: c.academicYears > 0 && c.terms > 0, optional: false },
    { label: 'Add your teaching staff', href: '/staff/new', done: c.staff > 0, optional: false },
    { label: 'Create at least one class', href: '/classes/new', done: c.classes > 0, optional: false },
    { label: 'Add or import students', href: '/students/new', done: c.students > 0, optional: false },
    { label: 'Configure email (SMTP) for invoices and reminders', href: '/settings', done: c.smtpConfigured, optional: true },
    { label: 'Define fee types (if you use finance)', href: '/finance', done: c.feeTypes > 0, optional: true },
  ]
}

export function OnboardingChecklist({ counts }: { counts: OnboardingCounts }) {
  const steps = buildOnboardingSteps(counts)
  const requiredLeft = steps.filter(s => !s.optional && !s.done).length
  if (requiredLeft === 0) return null

  const doneCount = steps.filter(s => s.done).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Getting started</CardTitle>
        <p className="text-sm text-slate-500">
          {doneCount} of {steps.length} steps complete. {requiredLeft} required step{requiredLeft === 1 ? '' : 's'} left.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {steps.map(step => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              {step.done
                ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" aria-label="Done" />
                : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" aria-label="To do" />}
              {step.done ? (
                <span className="text-slate-400 line-through">{step.label}</span>
              ) : (
                <Link href={step.href} className="text-primary hover:underline">{step.label}</Link>
              )}
              {step.optional && <span className="text-xs text-slate-400">(optional)</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

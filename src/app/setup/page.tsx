import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import SetupWizard from './setup-wizard'

export const metadata = { title: 'Initial Setup — TPT School' }

export default async function SetupPage() {
  const settings = await db.schoolSettings.findFirst()
  if (settings?.setupComplete) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
            T
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome to TPT School</h1>
          <p className="mt-2 text-slate-500">
            Let&apos;s get your school set up. This will only take a few minutes.
          </p>
        </div>
        <SetupWizard />
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import DashboardHeader from '@/components/nav/header'
import SidebarNav from '@/components/nav/sidebar'
import { GraduationCap } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireSession()

  // Ensure setup is complete
  const settings = await db.schoolSettings.findFirst()
  if (!settings?.setupComplete) redirect('/setup')

  const schoolName = settings.name

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 flex-shrink-0">
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate leading-tight">{schoolName}</p>
            <p className="text-xs text-slate-400 capitalize">{user.role}</p>
          </div>
        </div>

        {/* Nav items */}
        <SidebarNav role={user.role} />

        {/* Sidebar footer */}
        <div className="border-t border-slate-200 px-4 py-3 flex-shrink-0">
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} TPT School</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          schoolName={schoolName}
          user={{
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

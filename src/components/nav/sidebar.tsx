'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navItemsFor } from './nav-items'

type SidebarProps = {
  role: string
  onNavigate?: () => void
}

export default function SidebarNav({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const items = navItemsFor(role)

  return (
    <nav aria-label="Main" className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {items.map(item => {
        const Icon = item.icon
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

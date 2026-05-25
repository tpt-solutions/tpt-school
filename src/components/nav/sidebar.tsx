'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardList,
  Award,
  BarChart2,
  MessageSquare,
  DollarSign,
  Settings,
  GraduationCap,
  Bell,
  AlertTriangle,
  FileCheck,
  PlusCircle,
  LayoutList,
  BookMarked,
} from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard',     href: '/dashboard',            icon: LayoutDashboard },
    { label: 'Students',      href: '/students',             icon: GraduationCap },
    { label: 'Staff',         href: '/staff',                icon: UserCheck },
    { label: 'Classes',       href: '/classes',              icon: BookOpen },
    { label: 'Timetable',     href: '/timetable',            icon: Calendar },
    { label: 'Calendar',      href: '/calendar',             icon: CalendarDays },
    { label: 'Attendance',    href: '/attendance',           icon: ClipboardList },
    { label: 'Workload',      href: '/workload',             icon: LayoutList },
    { label: 'Grades',        href: '/grades',               icon: Award },
    { label: 'Reports',       href: '/reports',              icon: BarChart2 },
    { label: 'Behaviour',     href: '/behaviour',            icon: AlertTriangle },
    { label: 'Communication', href: '/communication',        icon: MessageSquare },
    { label: 'Finance',       href: '/finance',              icon: DollarSign },
    { label: 'Enrol Requests', href: '/enrollment-requests', icon: FileCheck },
    { label: 'Settings',      href: '/settings',             icon: Settings },
  ],
  teacher: [
    { label: 'Dashboard',     href: '/dashboard',       icon: LayoutDashboard },
    { label: 'My Classes',    href: '/classes',         icon: BookOpen },
    { label: 'Workload',      href: '/workload',        icon: LayoutList },
    { label: 'Timetable',     href: '/timetable',       icon: Calendar },
    { label: 'Calendar',      href: '/calendar',        icon: CalendarDays },
    { label: 'Attendance',    href: '/attendance',      icon: ClipboardList },
    { label: 'Grades',        href: '/grades',          icon: Award },
    { label: 'Behaviour',     href: '/behaviour',       icon: AlertTriangle },
    { label: 'Communication', href: '/communication',   icon: MessageSquare },
  ],
  parent: [
    { label: 'Dashboard',    href: '/dashboard',        icon: LayoutDashboard },
    { label: 'My Children',  href: '/children',         icon: Users },
    { label: 'Enroll',       href: '/portal/enroll',    icon: PlusCircle },
    { label: 'Attendance',   href: '/attendance',       icon: ClipboardList },
    { label: 'Grades',       href: '/grades',           icon: Award },
    { label: 'Calendar',     href: '/calendar',         icon: CalendarDays },
    { label: 'Notices',      href: '/notices',          icon: Bell },
  ],
  student: [
    { label: 'Dashboard',     href: '/dashboard',       icon: LayoutDashboard },
    { label: 'My Classes',    href: '/classes',         icon: BookOpen },
    { label: 'Assignments',   href: '/assignments',     icon: BookMarked },
    { label: 'Enroll',        href: '/portal/enroll',   icon: PlusCircle },
    { label: 'My Attendance', href: '/attendance',      icon: ClipboardList },
    { label: 'My Grades',     href: '/grades',          icon: Award },
    { label: 'Calendar',      href: '/calendar',        icon: CalendarDays },
    { label: 'Notices',       href: '/notices',         icon: Bell },
  ],
}

type SidebarProps = {
  role: string
  onNavigate?: () => void
}

export default function SidebarNav({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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

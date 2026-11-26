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
  Download,
  GraduationCap,
  Bell,
  AlertTriangle,
  FileCheck,
  PlusCircle,
  LayoutList,
  BookMarked,
  FileText,
  Receipt,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const NAV_ITEMS: Record<string, NavItem[]> = {
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
    { label: 'Import templates', href: '/templates',          icon: Download },
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
    { label: 'My Children',  href: '/portal',           icon: Users },
    { label: 'Enroll',       href: '/portal/enroll',    icon: PlusCircle },
    { label: 'Attendance',   href: '/attendance',       icon: ClipboardList },
    { label: 'Grades',       href: '/portal/grades',    icon: Award },
    { label: 'Report cards', href: '/portal/report-cards', icon: FileText },
    { label: 'Invoices',     href: '/portal/invoices',  icon: Receipt },
    { label: 'Calendar',     href: '/calendar',         icon: CalendarDays },
    { label: 'Notices',      href: '/portal/notices',   icon: Bell },
  ],
  student: [
    { label: 'Dashboard',     href: '/dashboard',       icon: LayoutDashboard },
    { label: 'My Classes',    href: '/classes',         icon: BookOpen },
    { label: 'Assignments',   href: '/assignments',     icon: BookMarked },
    { label: 'Enroll',        href: '/portal/enroll',   icon: PlusCircle },
    { label: 'My Attendance', href: '/attendance',      icon: ClipboardList },
    { label: 'My Grades',     href: '/portal/grades',   icon: Award },
    { label: 'Report cards',  href: '/portal/report-cards', icon: FileText },
    { label: 'Calendar',      href: '/calendar',        icon: CalendarDays },
    { label: 'Notices',       href: '/portal/notices', icon: Bell },
  ],
}

export function navItemsFor(role: string): NavItem[] {
  return NAV_ITEMS[role] ?? NAV_ITEMS.student
}

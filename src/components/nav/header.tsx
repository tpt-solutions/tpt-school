'use client'

import { useState } from 'react'
import { Menu, LogOut, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import SidebarNav from './sidebar'
import { signOutAction } from '@/app/(dashboard)/actions'

type HeaderProps = {
  schoolName: string
  user: {
    name: string
    email: string
    role: string
    avatar: string | null
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    teacher: 'Teacher',
    parent: 'Parent',
    student: 'Student',
  }
  return labels[role] ?? role
}

export default function DashboardHeader({ schoolName, user }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-16 flex items-center px-4 gap-4 shadow-sm">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden flex-shrink-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* School name */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-900 truncate hidden sm:block">
            {schoolName}
          </span>
        </div>

        <div className="flex-1" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-2 px-2 h-10 rounded-lg hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer"
          >
            <Avatar className="w-8 h-8">
              {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-900 leading-none">{user.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{getRoleLabel(user.role)}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-slate-500 font-normal mt-0.5">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOutAction()}
              className="cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={(open) => setMobileOpen(open)}>
        <SheetContent side="left" className="p-0 w-64 flex flex-col">
          <SheetHeader className="px-4 py-4 border-b border-slate-200">
            <SheetTitle className="flex items-center gap-2 text-left">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="font-semibold text-slate-900 truncate">{schoolName}</span>
            </SheetTitle>
          </SheetHeader>
          <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

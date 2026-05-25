import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ClipboardCheck, DollarSign, BarChart2, FileText, HeartHandshake, Database } from 'lucide-react'

const REPORT_CARDS = [
  {
    title: 'Attendance Report',
    description: 'View attendance summaries by student, year level, or date range.',
    href: '/reports/attendance',
    icon: ClipboardCheck,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'Grade Summary',
    description: 'Review grades and averages by class and term.',
    href: '/reports/grades',
    icon: BarChart2,
    color: 'bg-violet-100 text-violet-600',
  },
  {
    title: 'Report Cards',
    description: 'Generate and download student report cards as PDF.',
    href: '/reports/report-cards',
    icon: FileText,
    color: 'bg-rose-100 text-rose-600',
  },
  {
    title: 'Fee Summary',
    description: 'Overview of fees, payments, and outstanding balances.',
    href: '/finance',
    icon: DollarSign,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    title: 'Student Enrolment',
    description: 'View enrolment numbers by year level and status.',
    href: '/reports/enrolment',
    icon: Users,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    title: 'Parent Engagement',
    description: 'See which parents are actively logging in, reading notices, and paying on time.',
    href: '/reports/parent-engagement',
    icon: HeartHandshake,
    color: 'bg-pink-100 text-pink-600',
  },
  {
    title: 'SIS Data Export',
    description: 'Export student and attendance data in NZ MoE, Ed-Fi, UK SIMS, AU Synergetic, CA PowerSchool, and universal CSV formats.',
    href: '/reports/sis-export',
    icon: Database,
    color: 'bg-slate-100 text-slate-600',
  },
]

export default async function ReportsPage() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Analytics and summaries for school operations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_CARDS.map(card => (
          <Link key={card.href} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-100 h-full">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{card.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{card.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

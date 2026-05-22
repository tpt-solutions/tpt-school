import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Award } from 'lucide-react'
import { format } from 'date-fns'

const TYPE_COLORS: Record<string, string> = {
  assessment: 'bg-blue-100 text-blue-700',
  exam: 'bg-red-100 text-red-700',
  assignment: 'bg-green-100 text-green-700',
  project: 'bg-purple-100 text-purple-700',
}

export default async function GradesPage() {
  const user = await requireRole(['admin', 'teacher'])

  let gradebooks
  if (user.role === 'admin') {
    gradebooks = await db.gradebook.findMany({
      include: {
        class: true,
        term: { include: { academicYear: true } },
        _count: { select: { grades: true } },
      },
      orderBy: [{ dueDate: 'desc' }, { class: { name: 'asc' } }],
    })
  } else {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    gradebooks = staff
      ? await db.gradebook.findMany({
          where: { class: { teachers: { some: { staffId: staff.id } } } },
          include: {
            class: true,
            term: { include: { academicYear: true } },
            _count: { select: { grades: true } },
          },
          orderBy: [{ dueDate: 'desc' }, { class: { name: 'asc' } }],
        })
      : []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gradebook</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user.role === 'admin' ? 'All assessments' : 'Your class assessments'}
          </p>
        </div>
        <Link href="/grades/new" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          New Assessment
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Assessment</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-center">Max Score</TableHead>
              <TableHead className="text-center">Grades</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gradebooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                  <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No assessments found</p>
                </TableCell>
              </TableRow>
            ) : (
              gradebooks.map((gb) => (
                <TableRow key={gb.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{gb.name}</TableCell>
                  <TableCell className="text-slate-600">
                    <Link href={`/classes/${gb.classId}`} className="hover:text-primary">
                      {gb.class.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-600">{gb.term.name}</TableCell>
                  <TableCell>
                    <Badge className={(TYPE_COLORS[gb.type] ?? 'bg-slate-100 text-slate-700') + ' border-0 capitalize'}>
                      {gb.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {gb.dueDate ? format(new Date(gb.dueDate), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-center font-medium">{gb.maxScore}</TableCell>
                  <TableCell className="text-center text-slate-600">{gb._count.grades}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/grades/${gb.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Enter Grades</Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

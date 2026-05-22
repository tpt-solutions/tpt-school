import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, Eye } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ yearLevel?: string }>
}

export default async function ClassesPage({ searchParams }: PageProps) {
  const user = await requireRole(['admin', 'teacher'])
  const { yearLevel } = await searchParams

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })

  const classes = await db.class.findMany({
    where: {
      academicYearId: activeYear?.id,
      ...(yearLevel ? { yearLevel: Number(yearLevel) } : {}),
    },
    include: {
      room: true,
      teachers: {
        include: { staff: { include: { user: true } } },
        where: { isPrimary: true },
      },
      _count: { select: { enrolments: { where: { status: 'active' } } } },
    },
    orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
  })

  const yearLevels = Array.from({ length: 13 }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classes</h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeYear ? `${activeYear.year} Academic Year` : 'No active academic year'}
          </p>
        </div>
        {user.role === 'admin' && (
          <Link href="/classes/new" className={buttonVariants()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Class
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500 font-medium">Filter by Year Level:</span>
        <Link href="/classes">
          <Badge variant={!yearLevel ? 'default' : 'outline'} className="cursor-pointer">All</Badge>
        </Link>
        {yearLevels.map((yl) => (
          <Link key={yl} href={`/classes?yearLevel=${yl}`}>
            <Badge variant={yearLevel === String(yl) ? 'default' : 'outline'} className="cursor-pointer">
              Year {yl}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Year Level</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Room</TableHead>
              <TableHead className="text-center">Students</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No classes found</p>
                </TableCell>
              </TableRow>
            ) : (
              classes.map((cls) => {
                const primaryTeacher = cls.teachers[0]?.staff.user.name ?? '—'
                return (
                  <TableRow key={cls.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono font-medium text-slate-700">{cls.code}</TableCell>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell className="text-slate-600">{cls.subject ?? '—'}</TableCell>
                    <TableCell>
                      {cls.yearLevel ? (
                        <Badge variant="secondary">Year {cls.yearLevel}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">{primaryTeacher}</TableCell>
                    <TableCell className="text-slate-600">
                      {cls.room ? (
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{cls.room.code}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-slate-700 font-medium">{cls._count.enrolments}</span>
                      {cls.maxStudents ? (
                        <span className="text-slate-400 text-xs"> / {cls.maxStudents}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/classes/${cls.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

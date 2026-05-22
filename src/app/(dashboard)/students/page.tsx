import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Upload, Search } from 'lucide-react'

type SearchParams = Promise<{ q?: string; yearLevel?: string; status?: string }>

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  graduated: { label: 'Graduated', variant: 'outline' },
  transferred: { label: 'Transferred', variant: 'outline' },
}

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin', 'teacher'])

  const { q = '', yearLevel = '', status = '' } = await searchParams

  const students = await db.student.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { user: { name: { contains: q } } },
                { studentId: { contains: q } },
              ],
            }
          : {},
        yearLevel ? { yearLevel: parseInt(yearLevel, 10) } : {},
        status ? { enrollmentStatus: status } : {},
      ],
    },
    include: { user: true },
    orderBy: [{ enrollmentDate: 'desc' }],
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-1">
            {students.length} student{students.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/students/import" className={buttonVariants({ variant: 'outline' })}>
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link href="/students/new" className={buttonVariants()}>
            <UserPlus className="w-4 h-4" />
            Add Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name or student ID…"
            className="pl-8 w-full"
          />
        </div>

        <Select name="yearLevel" defaultValue={yearLevel || 'all'}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Year Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {Array.from({ length: 13 }, (_, i) => i + 1).map((yr) => (
              <SelectItem key={yr} value={String(yr)}>
                Year {yr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select name="status" defaultValue={status || 'all'}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="graduated">Graduated</SelectItem>
            <SelectItem value="transferred">Transferred</SelectItem>
          </SelectContent>
        </Select>

        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-700">Student ID</TableHead>
              <TableHead className="font-semibold text-slate-700">Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Year Level</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="font-semibold text-slate-700">Enrolment Date</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                  No students found. Try adjusting your search or filters.
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => {
                const statusInfo = STATUS_LABELS[student.enrollmentStatus] ?? {
                  label: student.enrollmentStatus,
                  variant: 'outline' as const,
                }
                return (
                  <TableRow key={student.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm text-slate-600">
                      {student.studentId}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{student.user.name}</div>
                      <div className="text-xs text-slate-400">{student.user.email}</div>
                    </TableCell>
                    <TableCell>
                      {student.yearLevel ? (
                        <span className="text-slate-700">Year {student.yearLevel}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {new Date(student.enrollmentDate).toLocaleDateString('en-NZ', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/students/${student.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>View</Link>
                        <Link href={`/students/${student.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Edit</Link>
                      </div>
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

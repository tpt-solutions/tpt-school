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
import { UserPlus, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { bulkSetStudentStatusAction } from './actions'

const PAGE_SIZE = 50

type SearchParams = Promise<{ q?: string; yearLevel?: string; status?: string; page?: string; sort?: string; dir?: string }>

type StudentOrder = NonNullable<NonNullable<Parameters<typeof db.student.findMany>[0]>['orderBy']>

const SORT_COLUMNS = ['name', 'yearLevel', 'enrolled'] as const
type SortColumn = typeof SORT_COLUMNS[number]

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  graduated: { label: 'Graduated', variant: 'outline' },
  transferred: { label: 'Transferred', variant: 'outline' },
}

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin', 'teacher'])

  const { q = '', yearLevel = '', status = '', page: pageParam = '1', sort: sortParam, dir: dirParam } = await searchParams

  // Whitelisted sort columns only; the direction defaults to the natural order for each column
  const sort: SortColumn = (SORT_COLUMNS as readonly string[]).includes(sortParam ?? '') ? (sortParam as SortColumn) : 'enrolled'
  const defaultDir = sort === 'name' || sort === 'yearLevel' ? 'asc' : 'desc'
  const dir: 'asc' | 'desc' = dirParam === 'asc' || dirParam === 'desc' ? dirParam : defaultDir
  const orderBy: StudentOrder =
    sort === 'name' ? [{ user: { name: dir } }, { id: 'asc' }] :
    sort === 'yearLevel' ? [{ yearLevel: dir }, { user: { name: 'asc' } }, { id: 'asc' }] :
    [{ enrollmentDate: dir }, { id: 'asc' }]

  const where = {
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
  }

  const total = await db.student.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const requestedPage = parseInt(pageParam, 10)
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1

  // Select only the user fields the table shows; never load passwordHash here
  const students = await db.student.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (yearLevel) params.set('yearLevel', yearLevel)
    if (status) params.set('status', status)
    if (sortParam && sort !== 'enrolled') params.set('sort', sort)
    if (dirParam && dir !== defaultDir) params.set('dir', dir)
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return qs ? `/students?${qs}` : '/students'
  }

  // Clicking a column header sorts by it; clicking the active column flips the direction
  const sortHref = (column: SortColumn) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (yearLevel) params.set('yearLevel', yearLevel)
    if (status) params.set('status', status)
    params.set('sort', column)
    const nextDefault = column === 'name' || column === 'yearLevel' ? 'asc' : 'desc'
    const nextDir = column === sort ? (dir === 'asc' ? 'desc' : 'asc') : nextDefault
    if (nextDir !== nextDefault) params.set('dir', nextDir)
    return `/students?${params.toString()}`
  }
  const sortIndicator = (column: SortColumn) => (sort === column ? (dir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} student{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/students/import" className={buttonVariants({ variant: 'outline' })}>
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link href="/students/guardians/import" className={buttonVariants({ variant: 'outline' })}>
            <Upload className="w-4 h-4" />
            Import guardians
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
            name="q" aria-label="Search students"
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
      <form id="bulk-students" action={bulkSetStudentStatusAction} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="bulk-status" className="text-slate-600">With selected students:</label>
          <select id="bulk-status" name="status" defaultValue="inactive" className="h-9 rounded-md border border-input bg-transparent px-2">
            <option value="inactive">Deactivate</option>
            <option value="active">Reactivate</option>
          </select>
          <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Apply</button>
        </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table className="table-stack">
          <caption className="sr-only">Students</caption>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>
              <TableHead className="font-semibold text-slate-700">Student ID</TableHead>
              <TableHead className="font-semibold text-slate-700"><Link href={sortHref('name')} className="hover:underline">Name{sortIndicator('name')}</Link></TableHead>
              <TableHead className="font-semibold text-slate-700"><Link href={sortHref('yearLevel')} className="hover:underline">Year Level{sortIndicator('yearLevel')}</Link></TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="font-semibold text-slate-700"><Link href={sortHref('enrolled')} className="hover:underline">Enrolment Date{sortIndicator('enrolled')}</Link></TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <p>No students found. Try adjusting your search or filters.</p>
                  <Link href="/students/new" className={buttonVariants({ size: 'sm' }) + ' mt-3'}>
                    Enrol a student
                  </Link>
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
                    <TableCell data-label="Select">
                      <input type="checkbox" name="ids" value={student.id} aria-label={`Select ${student.user.name}`} className="size-4" />
                    </TableCell>
                    <TableCell data-label="Student ID" className="font-mono text-sm text-slate-600">
                      {student.studentId}
                    </TableCell>
                    <TableCell data-label="Name">
                      <div className="font-medium text-slate-900">{student.user.name}</div>
                      <div className="text-xs text-slate-400">{student.user.email}</div>
                    </TableCell>
                    <TableCell data-label="Year level">
                      {student.yearLevel ? (
                        <span className="text-slate-700">Year {student.yearLevel}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell data-label="Enrolment date" className="text-slate-600 text-sm">
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
      </form>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pageCount}</span>
          <div className="flex gap-2">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + (page <= 1 ? ' pointer-events-none opacity-50' : '')}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Link>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pageCount}
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + (page >= pageCount ? ' pointer-events-none opacity-50' : '')}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

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
import { UserPlus, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react'

type SearchParams = Promise<{ q?: string; page?: string; status?: string; sort?: string; dir?: string }>

const SORT_COLUMNS = ['name', 'employeeId'] as const
type StaffSort = typeof SORT_COLUMNS[number]

const PAGE_SIZE = 50

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  casual: 'Casual',
}

export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin'])

  const { q = '', page: pageParam = '1', status: statusParam = 'active', sort: sortParam, dir: dirParam } = await searchParams

  // Only known values reach the query: the status filter and the sort column are whitelisted
  const status = statusParam === 'left' || statusParam === 'all' ? statusParam : 'active'
  const sort: StaffSort = (SORT_COLUMNS as readonly string[]).includes(sortParam ?? '') ? (sortParam as StaffSort) : 'name'
  const dir: 'asc' | 'desc' = dirParam === 'desc' ? 'desc' : 'asc'

  const where = {
    AND: [
      q
        ? {
            OR: [
              { user: { name: { contains: q } } },
              { employeeId: { contains: q } },
            ],
          }
        : {},
      status === 'active' ? { dateLeft: null } : status === 'left' ? { dateLeft: { not: null } } : {},
    ],
  }
  const orderBy = sort === 'employeeId'
    ? [{ employeeId: dir }, { id: 'asc' as const }]
    : [{ user: { name: dir } }, { id: 'asc' as const }]

  const total = await db.staff.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const requestedPage = parseInt(pageParam, 10)
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1

  const staffList = await db.staff.findMany({
    where,
    // Select only the user fields the table shows; never load passwordHash here
    include: { user: { select: { name: true, email: true } } },
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const listParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const values: Record<string, string | undefined> = { q, status, sort, dir, ...overrides }
    for (const [k, v] of Object.entries(values)) {
      if (v && !(k === 'status' && v === 'active') && !(k === 'sort' && v === 'name') && !(k === 'dir' && v === 'asc')) params.set(k, v)
    }
    const qs = params.toString()
    return qs ? `/staff?${qs}` : '/staff'
  }
  const pageHref = (target: number) => listParams({ page: target > 1 ? String(target) : undefined })
  // Clicking the active column flips its direction; clicking another column sorts ascending by it
  const sortHref = (column: StaffSort) =>
    listParams({ sort: column, dir: column === sort && dir === 'asc' ? 'desc' : 'asc', page: undefined })
  const sortIndicator = (column: StaffSort) => (sort === column ? (dir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} staff member{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/staff/import" className={buttonVariants({ variant: 'outline' })}>
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link href="/staff/new" className={buttonVariants()}>
            <UserPlus className="w-4 h-4" />
            Add Staff
          </Link>
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <select name="status" defaultValue={status} aria-label="Show" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
          <option value="active">Current staff</option>
          <option value="left">Left</option>
          <option value="all">All</option>
        </select>
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            name="q" aria-label="Search staff"
            defaultValue={q}
            placeholder="Search by name…"
            className="pl-8 w-full"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table className="table-stack">
          <caption className="sr-only">Staff members</caption>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-700"><Link href={sortHref('employeeId')} className="hover:underline">Employee ID{sortIndicator('employeeId')}</Link></TableHead>
              <TableHead className="font-semibold text-slate-700"><Link href={sortHref('name')} className="hover:underline">Name{sortIndicator('name')}</Link></TableHead>
              <TableHead className="font-semibold text-slate-700">Job Title</TableHead>
              <TableHead className="font-semibold text-slate-700">Department</TableHead>
              <TableHead className="font-semibold text-slate-700">Employment Type</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <p>No staff members found. Try adjusting your search or add a new staff member.</p>
                  <Link href="/staff/new" className={buttonVariants({ size: 'sm' }) + ' mt-3'}>
                    Add a staff member
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              staffList.map((staff) => {
                const isActive = !staff.dateLeft
                return (
                  <TableRow key={staff.id} className="hover:bg-slate-50/50">
                    <TableCell data-label="Employee ID" className="font-mono text-sm text-slate-600">
                      {staff.employeeId}
                    </TableCell>
                    <TableCell data-label="Name">
                      <div className="font-medium text-slate-900">{staff.user.name}</div>
                      <div className="text-xs text-slate-400">{staff.user.email}</div>
                    </TableCell>
                    <TableCell data-label="Job title" className="text-slate-700">
                      {staff.jobTitle ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell data-label="Department" className="text-slate-700">
                      {staff.department ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell data-label="Employment type">
                      {EMPLOYMENT_TYPE_LABELS[staff.employmentType] ?? staff.employmentType}
                    </TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Active' : 'Left'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/staff/${staff.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>View</Link>
                        <Link href={`/staff/${staff.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Edit</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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

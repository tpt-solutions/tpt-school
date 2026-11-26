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

type SearchParams = Promise<{ q?: string; page?: string }>

const PAGE_SIZE = 50

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  casual: 'Casual',
}

export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin'])

  const { q = '', page: pageParam = '1' } = await searchParams

  const where = q
    ? {
        OR: [
          { user: { name: { contains: q } } },
          { employeeId: { contains: q } },
        ],
      }
    : {}

  const total = await db.staff.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const requestedPage = parseInt(pageParam, 10)
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1

  const staffList = await db.staff.findMany({
    where,
    include: { user: true },
    orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return qs ? `/staff?${qs}` : '/staff'
  }

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
      <form method="GET" className="flex gap-3 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            name="q"
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
              <TableHead className="font-semibold text-slate-700">Employee ID</TableHead>
              <TableHead className="font-semibold text-slate-700">Name</TableHead>
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

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

const GRADE_PAGE_SIZE = 50
const GRADE_TYPES = ['assessment', 'exam', 'assignment', 'project'] as const
const SORTS = ['due', 'name', 'class'] as const

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; dir?: string; page?: string }>
}) {
  const user = await requireRole(['admin', 'teacher'])
  const { type: typeParam, sort: sortParam, dir: dirParam, page: pageParam = '1' } = await searchParams

  // Whitelisted filter and sort values only
  const type = (GRADE_TYPES as readonly string[]).includes(typeParam ?? '') ? typeParam : undefined
  const sort = (SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as (typeof SORTS)[number]) : 'due'
  const dir: 'asc' | 'desc' = dirParam === 'asc' || dirParam === 'desc' ? dirParam : sort === 'due' ? 'desc' : 'asc'
  const orderBy =
    sort === 'name' ? [{ name: dir }, { id: 'asc' as const }] :
    sort === 'class' ? [{ class: { name: dir } }, { id: 'asc' as const }] :
    [{ dueDate: dir }, { id: 'asc' as const }]

  let scope: Record<string, unknown> = {}
  if (user.role !== 'admin') {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    // A teacher sees only gradebooks for classes they teach; no staff profile means nothing
    scope = staff ? { class: { teachers: { some: { staffId: staff.id } } } } : { id: '__none__' }
  }
  const where = { ...scope, ...(type ? { type } : {}) }

  const total = await db.gradebook.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / GRADE_PAGE_SIZE))
  const requestedPage = parseInt(pageParam, 10)
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1

  const gradebooks = await db.gradebook.findMany({
    where,
    include: {
      class: true,
      term: { include: { academicYear: true } },
      _count: { select: { grades: true } },
    },
    orderBy,
    skip: (page - 1) * GRADE_PAGE_SIZE,
    take: GRADE_PAGE_SIZE,
  })

  const listParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const values: Record<string, string | undefined> = {
      type,
      sort: sort === 'due' ? undefined : sort,
      dir: dir === (sort === 'due' ? 'desc' : 'asc') ? undefined : dir,
      ...overrides,
    }
    for (const [k, v] of Object.entries(values)) if (v) params.set(k, v)
    const qs = params.toString()
    return qs ? `/grades?${qs}` : '/grades'
  }
  const sortHref = (column: (typeof SORTS)[number]) => {
    const defaultDir = column === 'due' ? 'desc' : 'asc'
    const nextDir = column === sort ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir
    return listParams({ sort: column, dir: nextDir, page: undefined })
  }
  const sortIndicator = (column: (typeof SORTS)[number]) => (sort === column ? (dir === 'asc' ? ' ↑' : ' ↓') : '')

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

      <nav aria-label="Filter assessments" className="flex flex-wrap items-center gap-2 text-sm">
        {(['all', ...GRADE_TYPES] as const).map((t) => (
          <Link
            key={t}
            href={listParams({ type: t === 'all' ? undefined : t, page: undefined })}
            aria-current={(type ?? 'all') === t ? 'page' : undefined}
            className={buttonVariants({ variant: (type ?? 'all') === t ? 'default' : 'outline', size: 'sm' }) + ' capitalize'}
          >
            {t === 'all' ? 'All types' : t}
          </Link>
        ))}
      </nav>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table className="table-stack">
          <caption className="sr-only">Gradebooks</caption>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead><Link href={sortHref('name')} className="hover:underline">Assessment{sortIndicator('name')}</Link></TableHead>
              <TableHead><Link href={sortHref('class')} className="hover:underline">Class{sortIndicator('class')}</Link></TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Type</TableHead>
              <TableHead><Link href={sortHref('due')} className="hover:underline">Due Date{sortIndicator('due')}</Link></TableHead>
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
                  <Link href="/grades/new" className={buttonVariants({ size: 'sm' }) + ' mt-3'}>
                    Create the first assessment
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              gradebooks.map((gb) => (
                <TableRow key={gb.id} className="hover:bg-slate-50">
                  <TableCell data-label="Assessment" className="font-medium">{gb.name}</TableCell>
                  <TableCell data-label="Class" className="text-slate-600">
                    <Link href={`/classes/${gb.classId}`} className="hover:text-primary">
                      {gb.class.name}
                    </Link>
                  </TableCell>
                  <TableCell data-label="Term" className="text-slate-600">{gb.term.name}</TableCell>
                  <TableCell data-label="Type">
                    <Badge className={(TYPE_COLORS[gb.type] ?? 'bg-slate-100 text-slate-700') + ' border-0 capitalize'}>
                      {gb.type}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Due date" className="text-slate-600">
                    {gb.dueDate ? format(new Date(gb.dueDate), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell data-label="Max score" className="text-center font-medium">{gb.maxScore}</TableCell>
                  <TableCell data-label="Grades" className="text-center text-slate-600">{gb._count.grades}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/grades/${gb.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Enter Grades</Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <nav aria-label="Assessment pages" className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pageCount} ({total} assessments)</span>
          <div className="flex gap-2">
            <Link
              href={listParams({ page: page > 1 ? String(page - 1) : undefined })}
              aria-disabled={page <= 1}
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + (page <= 1 ? ' pointer-events-none opacity-50' : '')}
            >
              Previous
            </Link>
            <Link
              href={listParams({ page: String(page + 1) })}
              aria-disabled={page >= pageCount}
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + (page >= pageCount ? ' pointer-events-none opacity-50' : '')}
            >
              Next
            </Link>
          </div>
        </nav>
      )}
    </div>
  )
}

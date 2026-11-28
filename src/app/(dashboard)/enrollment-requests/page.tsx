import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { pageWindow } from '@/lib/pagination'
import { Pager } from '@/components/ops/pager'
import EnrolmentRequestsList from './enrolment-requests-list'

const PAGE_SIZE = 50

type SearchParams = Promise<{ page?: string }>

export default async function EnrolmentRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin'])
  const { page: pageParam } = await searchParams

  const total = await db.enrolmentRequest.count({ where: { status: 'pending' } })
  const { page, pageCount, skip, take } = pageWindow(pageParam, total, PAGE_SIZE)

  const requests = await db.enrolmentRequest.findMany({
    where: { status: 'pending' },
    include: {
      class: { select: { id: true, name: true, code: true, maxStudents: true, _count: { select: { enrolments: { where: { status: 'active' } } } } } },
      student: { include: { user: { select: { name: true, email: true } } } },
      requestedBy: { select: { name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'asc' },
    skip,
    take,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Enrollment Requests</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Review and approve or reject student enrollment requests.
        </p>
      </div>

      <EnrolmentRequestsList requests={requests.map((r) => ({
        id: r.id,
        message: r.message,
        createdAt: r.createdAt,
        class: { id: r.class.id, name: r.class.name, code: r.class.code, maxStudents: r.class.maxStudents, enrolledCount: r.class._count.enrolments },
        student: { name: r.student.user.name, email: r.student.user.email },
        requestedBy: { name: r.requestedBy.name, role: r.requestedBy.role },
      }))} />

      <Pager
        page={page}
        pageCount={pageCount}
        total={total}
        hrefFor={(target) => (target > 1 ? `/enrollment-requests?page=${target}` : '/enrollment-requests')}
      />
    </div>
  )
}

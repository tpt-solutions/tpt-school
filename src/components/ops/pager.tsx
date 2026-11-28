import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/**
 * Previous / next controls for server-rendered lists. `hrefFor` builds the link for a
 * page number, so each page keeps its own filters and tab state.
 */
export function Pager({
  page,
  pageCount,
  total,
  hrefFor,
}: {
  page: number
  pageCount: number
  total: number
  hrefFor: (page: number) => string
}) {
  if (pageCount <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-slate-500">
      <span>
        Page {page} of {pageCount} ({total} total)
      </span>
      <div className="flex gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={buttonVariants({ variant: 'outline', size: 'sm' }) + (page <= 1 ? ' pointer-events-none opacity-50' : '')}
        >
          Previous
        </Link>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          className={buttonVariants({ variant: 'outline', size: 'sm' }) + (page >= pageCount ? ' pointer-events-none opacity-50' : '')}
        >
          Next
        </Link>
      </div>
    </nav>
  )
}

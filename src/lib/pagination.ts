/**
 * Shared paging math for server-rendered lists. Pages come from the `page` query
 * parameter; anything missing or invalid is treated as page 1, and a page past the
 * end is clamped to the last page.
 */
export function pageWindow(
  rawPage: string | undefined,
  total: number,
  pageSize: number,
): { page: number; pageCount: number; skip: number; take: number } {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const requested = rawPage ? parseInt(rawPage, 10) : 1
  const page = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), pageCount) : 1
  return { page, pageCount, skip: (page - 1) * pageSize, take: pageSize }
}

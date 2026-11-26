'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const bookSchema = z.object({
  title: field.required('Title', 200),
  author: field.optional('Author', 120),
  isbn: field.optional('ISBN', 20),
  category: field.optional('Category', 60),
  copies: field.int('Copies', 1, 500),
})

const checkoutSchema = z.object({
  bookId: field.required('Book', 64),
  studentId: field.required('Student', 64),
  dueDate: field.date('Due date'),
})

const idSchema = z.object({ id: field.required('Loan', 64) })

export async function addLibraryBookAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(bookSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { title, author, category, copies } = parsed.data
  const isbn = parsed.data.isbn ? parsed.data.isbn.replace(/[\s-]/g, '') : null

  if (isbn && !/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) {
    return { success: false, error: 'ISBN must be 10 or 13 digits.' }
  }
  if (isbn) {
    const existing = await db.libraryBook.findUnique({ where: { isbn }, select: { id: true } })
    if (existing) return { success: false, error: 'A book with this ISBN is already in the catalogue.' }
  }

  const book = await db.libraryBook.create({ data: { title, author, isbn, category, copies } })
  await logAudit(session.id, 'CREATE', 'LibraryBook', `Added book ${title}`, book.id)

  revalidatePath('/library')
  return { success: true }
}

export async function checkoutBookAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(checkoutSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { bookId, studentId, dueDate } = parsed.data

  if (dueDate.getTime() <= Date.now()) return { success: false, error: 'Due date must be in the future.' }

  const outcome = await db.$transaction(async (tx) => {
    const book = await tx.libraryBook.findUnique({ where: { id: bookId } })
    if (!book) return { error: 'Book not found.' as const }

    const out = await tx.libraryLoan.count({ where: { bookId, returnedAt: null } })
    if (out >= book.copies) return { error: 'No copies are available to borrow.' as const }

    const already = await tx.libraryLoan.findFirst({
      where: { bookId, studentId, returnedAt: null },
      select: { id: true },
    })
    if (already) return { error: 'This student already has a copy of this book.' as const }

    await tx.libraryLoan.create({ data: { bookId, studentId, dueDate, recordedById: session.id } })
    return { ok: true as const, title: book.title }
  })

  if ('error' in outcome) return { success: false, error: outcome.error }
  await logAudit(session.id, 'CREATE', 'LibraryLoan', `Checked out ${outcome.title}`, bookId)

  revalidatePath('/library')
  return { success: true }
}

export async function returnBookAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  // Only update loans that are still open, so a double-submit cannot change the return date
  const result = await db.libraryLoan.updateMany({
    where: { id: parsed.data.id, returnedAt: null },
    data: { returnedAt: new Date() },
  })
  if (result.count === 0) return { success: false, error: 'This loan has already been returned.' }
  await logAudit(session.id, 'UPDATE', 'LibraryLoan', 'Book returned', parsed.data.id)

  revalidatePath('/library')
  return { success: true }
}

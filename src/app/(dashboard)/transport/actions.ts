'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { field, formRecord, parseWith } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const DIRECTIONS = ['both', 'to_school', 'from_school'] as const

const routeSchema = z.object({
  name: field.required('Route name', 100),
  code: field.required('Route code', 20),
  driverName: field.optional('Driver name', 100),
  vehicleRegistration: field.optional('Vehicle registration', 40),
  capacity: field.optionalInt('Capacity', 1, 300),
})

const assignSchema = z.object({
  routeId: field.required('Route', 64),
  studentId: field.required('Student', 64),
  stop: field.optional('Stop', 100),
  direction: field.oneOf('Direction', DIRECTIONS),
})

const idSchema = z.object({ id: field.required('Assignment', 64) })

export async function createRouteAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(routeSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { name, driverName, vehicleRegistration, capacity } = parsed.data
  const code = parsed.data.code.toUpperCase()

  const existing = await db.transportRoute.findUnique({ where: { code }, select: { id: true } })
  if (existing) return { success: false, error: 'A route with this code already exists.' }

  const route = await db.transportRoute.create({
    data: { name, code, driverName, vehicleRegistration, capacity },
  })
  await logAudit(session.id, 'CREATE', 'TransportRoute', `Created route ${code}`, route.id)

  revalidatePath('/transport')
  return { success: true }
}

export async function setRouteActiveAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const active = formData.get('active') === 'true'

  await db.transportRoute.update({ where: { id: parsed.data.id }, data: { active } })
  await logAudit(session.id, 'UPDATE', 'TransportRoute', `Route ${active ? 'activated' : 'deactivated'}`, parsed.data.id)

  revalidatePath('/transport')
  return { success: true }
}

export async function assignStudentToRouteAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(assignSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { routeId, studentId, stop, direction } = parsed.data

  const outcome = await db.$transaction(async (tx) => {
    const route = await tx.transportRoute.findUnique({ where: { id: routeId } })
    if (!route) return { error: 'Route not found.' as const }
    if (!route.active) return { error: 'This route is inactive.' as const }

    const current = await tx.studentTransport.findUnique({
      where: { studentId_routeId: { studentId, routeId } },
    })
    if (current?.active) return { error: 'This student is already on this route.' as const }

    if (route.capacity !== null) {
      const seats = await tx.studentTransport.count({ where: { routeId, active: true } })
      if (seats >= route.capacity) return { error: 'This route is full.' as const }
    }

    if (current) {
      await tx.studentTransport.update({ where: { id: current.id }, data: { stop, direction, active: true } })
    } else {
      await tx.studentTransport.create({ data: { routeId, studentId, stop, direction } })
    }
    return { ok: true as const, code: route.code }
  })

  if ('error' in outcome) return { success: false, error: outcome.error }
  await logAudit(session.id, 'UPDATE', 'TransportRoute', `Assigned student to route ${outcome.code}`, routeId)

  revalidatePath('/transport')
  return { success: true }
}

export async function removeStudentFromRouteAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const parsed = parseWith(idSchema, formRecord(formData))
  if (!parsed.ok) return { success: false, error: parsed.error }

  // Soft-remove so the history of who rode which route is kept
  await db.studentTransport.update({ where: { id: parsed.data.id }, data: { active: false } })
  await logAudit(session.id, 'UPDATE', 'StudentTransport', 'Removed student from route', parsed.data.id)

  revalidatePath('/transport')
  return { success: true }
}

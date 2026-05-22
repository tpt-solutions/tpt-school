import { db } from '@/lib/db'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'

export async function logAudit(
  userId: string,
  action: AuditAction,
  entityType: string,
  summary: string,
  entityId?: string,
  ipAddress?: string,
) {
  try {
    await db.auditLog.create({
      data: { userId, action, entityType, entityId: entityId ?? null, summary, ipAddress: ipAddress ?? null },
    })
  } catch {
    // Audit logging must never crash the calling operation
  }
}

import 'server-only'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'

/**
 * Scheduled SQLite backups.
 *
 * Uses `VACUUM INTO`, which writes a consistent snapshot even while the app is writing, unlike a
 * plain file copy. Files go to BACKUP_DIR (default ./backups). The newest BACKUP_RETENTION files
 * are kept (default 7) and older ones are deleted.
 */

const BACKUP_PREFIX = 'tpt-backup-'
const BACKUP_SUFFIX = '.db'

export function backupDirectory(): string {
  return process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), 'backups')
}

export function backupRetention(): number {
  const n = Number(process.env.BACKUP_RETENTION)
  return Number.isInteger(n) && n > 0 ? n : 7
}

function timestamp(now: Date): string {
  // 2026-11-27T03-15-00Z: sortable, and safe in file names on Windows.
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-')
}

/** Lists backup files in the directory, newest first, by name (names embed the timestamp). */
async function listBackups(dir: string): Promise<string[]> {
  const entries = await readdir(dir).catch(() => [] as string[])
  return entries
    .filter(name => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX))
    .sort()
    .reverse()
}

/** Writes one snapshot and prunes old ones. Returns the new file path. */
export async function runBackup(now = new Date()): Promise<{ file: string; pruned: number }> {
  const dir = backupDirectory()
  await mkdir(dir, { recursive: true })

  const file = path.join(dir, `${BACKUP_PREFIX}${timestamp(now)}${BACKUP_SUFFIX}`)
  // Bound parameter: the path is never spliced into SQL.
  await db.$executeRaw`VACUUM INTO ${file}`

  const all = await listBackups(dir)
  const stale = all.slice(backupRetention())
  for (const name of stale) {
    await rm(path.join(dir, name), { force: true })
  }

  // Confirm the snapshot exists and is not empty before reporting success.
  const info = await stat(file)
  if (info.size === 0) throw new Error(`Backup ${file} is empty`)

  return { file, pruned: stale.length }
}

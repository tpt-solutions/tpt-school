import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { awardMeritAction, deleteMeritAwardAction } from './actions'

type StudentOption = { id: string; studentId: string; name: string }

export default async function MeritPage() {
  const session = await requireRole(['admin', 'teacher'])
  const isAdmin = session.role === 'admin'

  // Teachers only see (and can award) students enrolled in a class they teach
  let students: StudentOption[]
  if (isAdmin) {
    const all = await db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 2000,
    })
    students = all.map((s) => ({ id: s.id, studentId: s.studentId, name: s.user.name }))
  } else {
    const enrolments = await db.classEnrolment.findMany({
      where: {
        status: 'active',
        student: { enrollmentStatus: 'active' },
        class: { teachers: { some: { staff: { userId: session.id } } } },
      },
      include: { student: { include: { user: { select: { name: true } } } } },
      take: 2000,
    })
    const seen = new Map<string, StudentOption>()
    for (const e of enrolments) {
      if (!seen.has(e.studentId)) seen.set(e.studentId, { id: e.studentId, studentId: e.student.studentId, name: e.student.user.name })
    }
    students = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  const [totals, recent] = await Promise.all([
    db.meritAward.groupBy({
      by: ['studentId'],
      _sum: { points: true },
      _count: { _all: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 20,
    }),
    db.meritAward.findMany({
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { awardedAt: 'desc' },
      take: 30,
    }),
  ])

  const names = new Map(students.map((s) => [s.id, s.name] as const))
  const missingIds = totals.map((t) => t.studentId).filter((id) => !names.has(id))
  if (missingIds.length) {
    const extra = await db.student.findMany({
      where: { id: { in: missingIds } },
      include: { user: { select: { name: true } } },
    })
    for (const s of extra) names.set(s.id, s.user.name)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Merit awards</h1>
        <p className="text-sm text-slate-500 mt-1">Recognise effort and achievement. Points are shown on the leaderboard.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Award merit points</CardTitle></CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-slate-500">No students are available to award.</p>
          ) : (
            <ActionForm action={awardMeritAction} submitLabel="Award points">
              <Field label="Student *" htmlFor="studentId">
                <select id="studentId" name="studentId" required defaultValue="" className={controlClass}>
                  <option value="" disabled>Select student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.studentId})</option>)}
                </select>
              </Field>
              <div className="grid gap-3 md:grid-cols-[8rem_1fr]">
                <Field label="Points *" htmlFor="points">
                  <input id="points" name="points" type="number" min={1} max={10} defaultValue={1} required className={controlClass} />
                </Field>
                <Field label="Reason *" htmlFor="reason">
                  <input id="reason" name="reason" required maxLength={300} placeholder="e.g. Helped a classmate" className={controlClass} />
                </Field>
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Leaderboard</CardTitle></CardHeader>
          <CardContent>
            {totals.length === 0 ? (
              <p className="text-sm text-slate-500">No merit points awarded yet.</p>
            ) : (
              <ol className="space-y-2">
                {totals.map((t, i) => (
                  <li key={t.studentId} className="flex items-center justify-between text-sm">
                    <span>{i + 1}. {names.get(t.studentId) ?? 'Unknown student'}</span>
                    <span className="font-semibold text-slate-900">{t._sum.points ?? 0} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent awards</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing awarded yet.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{a.student.user.name} · +{a.points}</div>
                      <div className="text-slate-600">{a.reason}</div>
                      <div className="text-xs text-slate-400">{a.awardedAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    {isAdmin && (
                      <ActionForm action={deleteMeritAwardAction} submitLabel="Remove" variant="ghost" hidden={{ id: a.id }} resetOnSuccess={false} confirmMessage="Remove this award?">
                        {null}
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

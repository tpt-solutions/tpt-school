import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionForm, Field, controlClass } from '@/components/ops/action-form'
import { createRouteAction, setRouteActiveAction, assignStudentToRouteAction, removeStudentFromRouteAction } from './actions'

const DIRECTION_LABELS: Record<string, string> = {
  both: 'Both ways',
  to_school: 'To school',
  from_school: 'From school',
}

export default async function TransportPage() {
  await requireRole(['admin'])

  const [routes, students] = await Promise.all([
    db.transportRoute.findMany({
      include: {
        students: {
          where: { active: true },
          include: { student: { include: { user: { select: { name: true } } } } },
          orderBy: { stop: 'asc' },
        },
      },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    }),
    db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 2000,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transport</h1>
        <p className="text-sm text-slate-500 mt-1">Bus routes, drivers, capacity and student pick-up stops.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add a route</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createRouteAction} submitLabel="Add route">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Route name *" htmlFor="name"><input id="name" name="name" required maxLength={100} className={controlClass} /></Field>
              <Field label="Route code *" htmlFor="code"><input id="code" name="code" required maxLength={20} className={controlClass} /></Field>
              <Field label="Capacity" htmlFor="capacity"><input id="capacity" name="capacity" type="number" min={1} max={300} className={controlClass} /></Field>
              <Field label="Driver" htmlFor="driverName"><input id="driverName" name="driverName" maxLength={100} className={controlClass} /></Field>
              <Field label="Vehicle registration" htmlFor="vehicleRegistration"><input id="vehicleRegistration" name="vehicleRegistration" maxLength={40} className={controlClass} /></Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {routes.length === 0 && <p className="text-sm text-slate-500">No routes yet. Add one above.</p>}

      {routes.map((route) => {
        const seated = route.students.length
        const assignedIds = new Set(route.students.map((s) => s.studentId))
        const available = students.filter((s) => !assignedIds.has(s.id))
        return (
          <Card key={route.id} className={route.active ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <span className="font-mono text-slate-500 mr-2">{route.code}</span>{route.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{seated}{route.capacity ? ` / ${route.capacity}` : ''} seats</Badge>
                  {!route.active && <Badge variant="outline">Inactive</Badge>}
                  <ActionForm action={setRouteActiveAction} submitLabel={route.active ? 'Deactivate' : 'Reactivate'} variant="outline" hidden={{ id: route.id, active: route.active ? 'false' : 'true' }} resetOnSuccess={false}>
                    {null}
                  </ActionForm>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {route.driverName ? `Driver: ${route.driverName}` : 'No driver assigned'}
                {route.vehicleRegistration ? ` · Vehicle ${route.vehicleRegistration}` : ''}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {seated === 0 ? (
                <p className="text-sm text-slate-500">No students on this route.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-stack">
                    <caption className="sr-only">Students on route {route.name}</caption>
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Stop</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Direction</th>
                        <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {route.students.map((rs) => (
                        <tr key={rs.id} className="border-b last:border-0">
                          <td data-label="Student" className="py-2 pr-4">{rs.student.user.name}</td>
                          <td data-label="Stop" className="py-2 pr-4 text-slate-600">{rs.stop ?? '—'}</td>
                          <td data-label="Direction" className="py-2 pr-4 text-slate-600">{DIRECTION_LABELS[rs.direction] ?? rs.direction}</td>
                          <td data-label="Actions" className="py-2 text-right">
                            <ActionForm action={removeStudentFromRouteAction} submitLabel="Remove" variant="ghost" hidden={{ id: rs.id }} resetOnSuccess={false} confirmMessage="Remove this student from the route?">
                              {null}
                            </ActionForm>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {route.active && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-700">Add a student</h3>
                  <ActionForm action={assignStudentToRouteAction} submitLabel="Add to route" hidden={{ routeId: route.id }}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Student *" htmlFor={`stu-${route.id}`}>
                        <select id={`stu-${route.id}`} name="studentId" required defaultValue="" className={controlClass}>
                          <option value="" disabled>Select student…</option>
                          {available.map((s) => <option key={s.id} value={s.id}>{s.user.name} ({s.studentId})</option>)}
                        </select>
                      </Field>
                      <Field label="Stop" htmlFor={`stop-${route.id}`}><input id={`stop-${route.id}`} name="stop" maxLength={100} className={controlClass} /></Field>
                      <Field label="Direction" htmlFor={`dir-${route.id}`}>
                        <select id={`dir-${route.id}`} name="direction" defaultValue="both" className={controlClass}>
                          {Object.entries(DIRECTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </Field>
                    </div>
                  </ActionForm>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

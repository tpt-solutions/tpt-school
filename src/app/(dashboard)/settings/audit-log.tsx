import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Log = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  ipAddress: string | null
  createdAt: Date
  user: { name: string; email: string }
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-slate-100 text-slate-700',
  EXPORT: 'bg-purple-100 text-purple-800',
}

export default function AuditLogView({ logs }: { logs: Log[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <p className="text-sm text-slate-500">Last 100 system events. Records who changed what and when.</p>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No audit events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">When</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">User</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Action</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{log.user.name}</span>
                      <br />
                      <span className="text-xs text-slate-400">{log.user.email}</span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-700'}`}>
                        {log.action}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">{log.entityType}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-700 max-w-md truncate">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

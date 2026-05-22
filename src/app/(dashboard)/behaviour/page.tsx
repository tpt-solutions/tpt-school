import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-yellow-100 text-yellow-800",
  moderate: "bg-orange-100 text-orange-800",
  major: "bg-red-100 text-red-800",
  critical: "bg-red-700 text-white",
};

export default async function BehaviourPage() {
  await requireRole(["admin", "teacher"]);

  const [incidents, suspensions, truancyAlerts] = await Promise.all([
    db.behaviourIncident.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
    db.suspension.findMany({
      where: { returnDate: null },
      include: { student: { include: { user: true } } },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    db.truancyAlert.findMany({
      where: { resolvedAt: null },
      include: { student: { include: { user: true } } },
      orderBy: { alertDate: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Behaviour & Wellbeing
          </h1>
          <p className="text-sm text-gray-500">
            Incidents, suspensions, truancy, and student exits
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/behaviour/exit" className={buttonVariants({ variant: 'outline' })}>
            Process Student Exit
          </Link>
          <Link href="/behaviour/new" className={buttonVariants()}>
            Log Incident
          </Link>
        </div>
      </div>

      {/* Active alerts */}
      {(truancyAlerts.length > 0 || suspensions.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {truancyAlerts.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-orange-800">
                  Truancy Alerts ({truancyAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {truancyAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded bg-white p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {alert.student.user.name}
                      </span>
                      <span className="ml-2 text-gray-500">
                        {alert.consecutiveAbsences} consecutive ·{" "}
                        {alert.totalUnexcused} total unexcused
                      </span>
                    </div>
                    <Link
                      href={`/students/${alert.studentId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {suspensions.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-800">
                  Current Suspensions ({suspensions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suspensions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded bg-white p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{s.student.user.name}</span>
                      <span className="ml-2 text-gray-500">
                        Until {format(new Date(s.endDate), "dd MMM")} ·{" "}
                        {s.type}
                      </span>
                    </div>
                    <Link
                      href={`/students/${s.studentId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Incidents table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No incidents recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(inc.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/students/${inc.studentId}`}
                        className="font-medium hover:underline"
                      >
                        {inc.student.user.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[inc.severity] ?? ""}`}
                      >
                        {inc.severity}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-gray-600">
                      {inc.description}
                    </TableCell>
                    <TableCell>
                      {inc.followUpRequired && !inc.followUpNotes && (
                        <Badge variant="outline" className="text-orange-600">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/behaviour/${inc.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>View</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

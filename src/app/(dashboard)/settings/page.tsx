import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SettingsForm from './settings-form'
import AcademicYearForm from './academic-year-form'
import SmtpForm from './smtp-form'
import EmailProviderForm from './email-provider-form'
import AiForm from './ai-form'
import AuditLogView from './audit-log'
import RoomsForm from './rooms-form'

export default async function SettingsPage() {
  const user = await requireRole(['admin'])

  const [settings, academicYears, recentAuditLogs, rooms] = await Promise.all([
    db.schoolSettings.findFirst(),
    db.academicYear.findMany({
      include: { terms: { orderBy: { termNumber: 'asc' } } },
      orderBy: { year: 'desc' },
    }),
    db.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.room.findMany({ orderBy: { name: 'asc' } }),
  ])

  const schoolSettings = {
    name: settings?.name ?? '',
    shortName: settings?.shortName ?? null,
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    website: settings?.website ?? null,
    schoolType: settings?.schoolType ?? null,
    timezone: settings?.timezone ?? 'UTC',
    currencyCode: settings?.currencyCode ?? 'USD',
    currencySymbol: settings?.currencySymbol ?? '$',
  }

  const smtpSettings = {
    smtpHost: settings?.smtpHost ?? null,
    smtpPort: settings?.smtpPort ?? null,
    smtpUser: settings?.smtpUser ?? null,
    smtpFrom: settings?.smtpFrom ?? null,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage school configuration and preferences.</p>
      </div>

      <Tabs defaultValue="school">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="school">School Info</TabsTrigger>
          <TabsTrigger value="academic">Academic Years</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="email-provider">Email Provider</TabsTrigger>
          <TabsTrigger value="ai">AI Integration</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="school" className="mt-6 max-w-2xl">
          <SettingsForm settings={schoolSettings} />
        </TabsContent>

        <TabsContent value="academic" className="mt-6 max-w-3xl">
          <AcademicYearForm years={academicYears} />
        </TabsContent>

        <TabsContent value="smtp" className="mt-6 max-w-2xl">
          <SmtpForm settings={smtpSettings} adminEmail={user.email} />
        </TabsContent>

        <TabsContent value="email-provider" className="mt-6 max-w-2xl">
          <EmailProviderForm
            emailProvider={settings?.emailProvider ?? 'smtp'}
            adminEmail={user.email}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-6 max-w-2xl">
          <AiForm
            aiProvider={settings?.aiProvider ?? 'none'}
            aiModel={settings?.aiModel ?? null}
            aiBaseUrl={settings?.aiBaseUrl ?? null}
            aiReportMode={settings?.aiReportMode ?? 'assist'}
          />
        </TabsContent>

        <TabsContent value="rooms" className="mt-6 max-w-3xl">
          <RoomsForm rooms={rooms} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogView logs={recentAuditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

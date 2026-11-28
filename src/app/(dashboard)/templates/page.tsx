import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download } from 'lucide-react'

// Sample import files shipped in public/templates/. Previewed here so admins can see
// the expected columns and example values before downloading.
const TEMPLATES = [
  {
    file: 'students-template.csv',
    title: 'Student import',
    description: 'Creates student accounts. Import from Students → Import.',
    required: ['firstName', 'lastName', 'email'],
  },
  {
    file: 'staff-template.csv',
    title: 'Staff import',
    description: 'Creates staff accounts. Import from Staff → Import.',
    required: ['firstName', 'lastName', 'email'],
  },
  {
    file: 'timetable-template.csv',
    title: 'Timetable import',
    description: 'Adds timetable periods for the active year. Import from Timetable → Import.',
    required: ['classCode', 'day', 'period', 'startTime', 'endTime'],
  },
  {
    file: 'guardians-template.csv',
    title: 'Guardian import',
    description: 'Links guardians to existing students. Import from Students → Import guardians.',
    required: ['studentId', 'email', 'firstName', 'lastName'],
  },
  {
    file: 'classes-template.csv',
    title: 'Class import',
    description: 'Creates classes in the active academic year. Import from Classes → Import.',
    required: ['name', 'code'],
  },
  {
    file: 'enrolments-template.csv',
    title: 'Enrolment import',
    description: 'Enrols students in classes of the active year. Import from Classes → Enrol students.',
    required: ['studentCode', 'classCode'],
  },
  {
    file: 'fee-types-template.csv',
    title: 'Fee type import',
    description: 'Creates fee types with amounts in dollars. Import from Finance → Fee Types → Import.',
    required: ['name', 'amount'],
  },
]

async function readPreview(file: string): Promise<string[][]> {
  const text = await readFile(path.join(process.cwd(), 'public', 'templates', file), 'utf8')
  return text.trim().split(/\r?\n/).map(line => line.split(','))
}

export default async function TemplatesPage() {
  await requireSession()
  const previews = await Promise.all(TEMPLATES.map(t => readPreview(t.file)))

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import templates</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Download a sample file, replace the example rows with your data, then upload it on the matching import page.
          Wrap any value that contains a comma in double quotes, for example &quot;Maths, Year 7&quot;.
        </p>
      </div>

      {TEMPLATES.map((t, i) => {
        const [header, ...rows] = previews[i]
        return (
          <Card key={t.file}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">{t.title}</CardTitle>
                <p className="text-sm text-slate-500 mt-1">{t.description}</p>
                <p className="text-xs text-slate-500 mt-1">Required columns: {t.required.join(', ')}</p>
              </div>
              <a
                href={`/templates/${t.file}`}
                download
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </a>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm table-stack">
                  <caption className="sr-only">Example rows for {t.title}</caption>
                  <thead className="bg-slate-50">
                    <tr>
                      {header.map(h => (
                        <th key={h} scope="col" className="px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap">
                          {h}{t.required.includes(h) ? ' *' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, ri) => (
                      <tr key={ri} className="border-t border-slate-100">
                        {r.map((c, ci) => (
                          <td key={ci} data-label={header[ci]} className="px-3 py-2 text-slate-600 whitespace-nowrap">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Link href="/students" className={buttonVariants({ variant: 'ghost' })}>Back to students</Link>
    </div>
  )
}

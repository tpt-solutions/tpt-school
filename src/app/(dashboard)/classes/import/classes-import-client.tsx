'use client'

import CsvImportPanel, { type CsvRowCheck } from '@/components/csv-import-panel'
import { importClassesAction } from './actions'

const COLUMNS = ['name', 'code', 'subject', 'yearLevel', 'maxStudents', 'periodsPerWeek', 'description']

function validateClassRow(data: Record<string, string>): CsvRowCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data.name) errors.push('name is required')
  if (!data.code) errors.push('code is required')
  else if (data.code.length > 30) errors.push('code must be 30 characters or fewer')

  for (const key of ['yearLevel', 'maxStudents', 'periodsPerWeek']) {
    const v = data[key]
    if (v && !/^\d+$/.test(v)) errors.push(`${key} must be a whole number`)
  }
  if (data.periodsPerWeek === '' && data.name) warnings.push('periodsPerWeek blank: will default to 5')

  return { errors, warnings }
}

export default function ClassesImportClient() {
  return (
    <CsvImportPanel
      columns={COLUMNS}
      formatHelp="Classes are created in the active academic year. A class whose code already exists that year is skipped. yearLevel, maxStudents and periodsPerWeek must be whole numbers."
      templateHref="/templates/classes-template.csv"
      validate={validateClassRow}
      importRows={importClassesAction}
      successHref="/classes"
      entityLabel="class(es)"
    />
  )
}

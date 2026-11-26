'use client'

import CsvImportPanel, { type CsvRowCheck } from '@/components/csv-import-panel'
import { importGuardiansAction } from './actions'

const COLUMNS = ['studentId', 'email', 'firstName', 'lastName', 'phone', 'relationship', 'isPrimary']

function validateGuardianRow(data: Record<string, string>): CsvRowCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data.studentId) errors.push('studentId is required')
  if (!data.email) errors.push('email is required')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('email must be a valid address')
  if (!data.firstName) errors.push('firstName is required')
  if (!data.lastName) errors.push('lastName is required')

  const primary = (data.isPrimary ?? '').toLowerCase()
  if (primary && !['true', 'false', 'yes', 'no', 'y', 'n', '1', '0'].includes(primary)) {
    errors.push('isPrimary must be true or false')
  }
  if (!data.isPrimary && data.studentId) warnings.push('isPrimary blank: will be treated as not primary')

  return { errors, warnings }
}

export default function GuardiansImportClient() {
  return (
    <CsvImportPanel
      columns={COLUMNS}
      formatHelp="Each row links one guardian to a student. studentId must match an existing student number. New guardians get an account with no password set: they use Forgot password to sign in. An existing parent account is linked, and an existing link is skipped."
      templateHref="/templates/guardians-template.csv"
      validate={validateGuardianRow}
      importRows={importGuardiansAction}
      successHref="/students"
      entityLabel="guardian link(s)"
    />
  )
}

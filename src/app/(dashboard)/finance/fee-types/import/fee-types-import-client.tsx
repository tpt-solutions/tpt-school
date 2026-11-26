'use client'

import CsvImportPanel, { type CsvRowCheck } from '@/components/csv-import-panel'
import { importFeeTypesAction } from './actions'

const COLUMNS = ['name', 'amount', 'frequency', 'yearLevel', 'description']

function validateFeeTypeRow(data: Record<string, string>): CsvRowCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data.name) errors.push('name is required')
  if (!data.amount) errors.push('amount is required')
  else if (!/^\d+(\.\d{1,2})?$/.test(data.amount)) errors.push('amount must be dollars, for example 150 or 85.50')

  if (data.frequency && !['annual', 'term'].includes(data.frequency)) {
    errors.push('frequency must be annual or term')
  }
  if (data.yearLevel && !/^\d+$/.test(data.yearLevel)) errors.push('yearLevel must be a whole number')

  return { errors, warnings }
}

export default function FeeTypesImportClient() {
  return (
    <CsvImportPanel
      columns={COLUMNS}
      formatHelp="amount is in dollars (no currency symbol). frequency is annual or term and defaults to annual. A fee type whose name already exists is skipped."
      templateHref="/templates/fee-types-template.csv"
      validate={validateFeeTypeRow}
      importRows={importFeeTypesAction}
      successHref="/finance/fee-types"
      entityLabel="fee type(s)"
    />
  )
}

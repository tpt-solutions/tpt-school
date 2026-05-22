import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Attendance module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('attendance page loads', async ({ page }) => {
    await page.goto('/attendance')
    await expect(page.getByRole('heading', { name: /attendance/i })).toBeVisible()
  })

  test('attendance report page loads', async ({ page }) => {
    await page.goto('/reports/attendance')
    await expect(page.getByRole('heading', { name: /attendance/i })).toBeVisible()
  })
})

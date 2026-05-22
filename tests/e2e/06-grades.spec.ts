import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Grades module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('gradebook list loads', async ({ page }) => {
    await page.goto('/grades')
    await expect(page.getByRole('heading', { name: /grade|gradebook/i })).toBeVisible()
  })

  test('grade summary report loads', async ({ page }) => {
    await page.goto('/reports/grades')
    await expect(page.getByRole('heading', { name: /grade summary/i })).toBeVisible()
  })
})

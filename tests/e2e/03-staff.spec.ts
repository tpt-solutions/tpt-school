import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Staff module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('navigates to staff list', async ({ page }) => {
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: /staff/i })).toBeVisible()
  })

  test('new staff form renders', async ({ page }) => {
    await page.goto('/staff/new')
    await expect(page.getByLabel(/Full Name/i)).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
  })
})

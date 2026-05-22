import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Communication module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('communication page loads', async ({ page }) => {
    await page.goto('/communication')
    await expect(page.getByRole('heading', { name: /communication|messages|notices/i })).toBeVisible()
  })

  test('compose message form renders', async ({ page }) => {
    await page.goto('/communication/compose')
    await expect(page.getByRole('heading', { name: /compose|new message/i })).toBeVisible()
  })

  test('new notice form renders', async ({ page }) => {
    await page.goto('/communication/notices/new')
    await expect(page.getByRole('heading', { name: /notice/i })).toBeVisible()
  })
})

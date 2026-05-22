import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Behaviour module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('behaviour incidents list loads', async ({ page }) => {
    await page.goto('/behaviour')
    await expect(page.getByRole('heading', { name: /behaviour/i })).toBeVisible()
  })

  test('new incident form renders', async ({ page }) => {
    await page.goto('/behaviour/new')
    await expect(page.getByRole('heading', { name: /incident/i })).toBeVisible()
  })

  test('exit records page loads', async ({ page }) => {
    await page.goto('/behaviour/exit')
    await expect(page.getByRole('heading', { name: /exit/i })).toBeVisible()
  })
})

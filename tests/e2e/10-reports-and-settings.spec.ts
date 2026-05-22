import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Reports & Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('reports index loads', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible()
    await expect(page.getByText(/attendance report/i)).toBeVisible()
    await expect(page.getByText(/grade summary/i)).toBeVisible()
    await expect(page.getByText(/report cards/i)).toBeVisible()
  })

  test('report cards page loads', async ({ page }) => {
    await page.goto('/reports/report-cards')
    await expect(page.getByRole('heading', { name: /report cards/i })).toBeVisible()
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })

  test('health check endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})

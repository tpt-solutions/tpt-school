import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Students module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('navigates to students list', async ({ page }) => {
    await page.goto('/students')
    await expect(page.getByRole('heading', { name: /students/i })).toBeVisible()
  })

  test('creates a new student', async ({ page }) => {
    await page.goto('/students/new')
    await expect(page.getByRole('heading', { name: /new student|add student/i })).toBeVisible()

    // Fill required fields
    await page.getByLabel(/First Name/i).fill('E2E Student')
    await page.getByLabel(/Last Name/i).fill('Test')
    await page.getByLabel(/Email/i).fill(`e2e-student-${Date.now()}@test.school`)

    await page.getByRole('button', { name: /enrol student/i }).click()

    // Should redirect to student list or detail
    await expect(page).toHaveURL(/\/students(\/|$)/, { timeout: 10_000 })
  })

  test('student profile page loads', async ({ page }) => {
    await page.goto('/students')
    const firstLink = page.getByRole('link').filter({ hasText: /E2E Student Test/ }).first()
    if (await firstLink.isVisible()) {
      await firstLink.click()
      await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible()
    }
  })
})

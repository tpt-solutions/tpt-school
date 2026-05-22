import { test, expect } from '@playwright/test'
import { setupIfNeeded, loginAsAdmin, TEST_ADMIN } from './helpers'

test.describe('Setup wizard + login', () => {
  test('runs setup wizard on first visit', async ({ page }) => {
    const setupRan = await setupIfNeeded(page)
    if (setupRan) {
      // Redirected to dashboard after setup
      await expect(page).toHaveURL(/\/dashboard/)
    } else {
      // Already set up — just verify login still works
      await loginAsAdmin(page)
      await expect(page).toHaveURL(/\/dashboard/)
    }
  })

  test('login page rejects wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(TEST_ADMIN.email)
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('text=/invalid|incorrect|failed/i')).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('protected routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('logs in as admin and sees dashboard', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('signs out', async ({ page }) => {
    await loginAsAdmin(page)
    // Find and click sign-out (button or menu item)
    const signOut = page.getByRole('button', { name: /sign out|log out/i })
    await signOut.click()
    await page.waitForURL(/\/login/, { timeout: 5_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})

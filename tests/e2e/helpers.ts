import { Page, expect } from '@playwright/test'

export const TEST_ADMIN = {
  email: 'e2e-admin@tptschool.test',
  password: 'Test1234!',
  name: 'E2E Admin',
}

export const TEST_SCHOOL = {
  name: 'E2E Test School',
  shortName: 'E2TS',
  currentYear: new Date().getFullYear().toString(),
}

/**
 * Log in as the test admin. Assumes setup has already been completed.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/dashboard/)
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password)
}

/**
 * Run the setup wizard if the app redirects to /setup.
 * Returns true if setup was performed, false if already set up.
 */
export async function setupIfNeeded(page: Page): Promise<boolean> {
  await page.goto('/')
  await page.waitForURL(/\/(setup|login|dashboard)/, { timeout: 10_000 })

  if (!page.url().includes('/setup')) return false

  // Step 1 — School info
  await page.getByLabel(/School Name/).fill(TEST_SCHOOL.name)
  await page.getByLabel(/Short Name/).fill(TEST_SCHOOL.shortName)

  const yearInput = page.locator('input[name="currentYear"], input[placeholder*="year" i], input[id*="year" i]').first()
  await yearInput.fill(TEST_SCHOOL.currentYear)

  await page.getByRole('button', { name: /next/i }).click()

  // Step 2 — Admin account
  await page.getByLabel(/Admin Name|Full Name/i).fill(TEST_ADMIN.name)
  await page.getByLabel(/Admin Email|Email/i).fill(TEST_ADMIN.email)
  await page.getByLabel(/^Password/).fill(TEST_ADMIN.password)
  await page.getByLabel(/Confirm Password/i).fill(TEST_ADMIN.password)
  await page.getByRole('button', { name: /next/i }).click()

  // Step 3 — Review & confirm
  await page.getByRole('button', { name: /complete setup|finish|confirm/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  return true
}

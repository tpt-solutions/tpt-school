import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Classes & Timetable', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('classes list loads', async ({ page }) => {
    await page.goto('/classes')
    await expect(page.getByRole('heading', { name: /classes/i })).toBeVisible()
  })

  test('timetable grid loads', async ({ page }) => {
    await page.goto('/timetable')
    await expect(page.getByRole('heading', { name: /timetable/i })).toBeVisible()
  })

  test('new class form renders', async ({ page }) => {
    await page.goto('/classes/new')
    await expect(page.getByLabel(/Class Name/i)).toBeVisible()
    await expect(page.getByLabel(/Class Code/i)).toBeVisible()
  })
})

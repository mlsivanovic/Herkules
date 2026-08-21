// Shared E2E helpers. An auto-fixture skips every test gracefully (exit code
// 0) when the TEST project env (.env.test.local) is not configured — this
// works uniformly for tests declared at file level and inside describes.
import { test as base, expect, type Page } from '@playwright/test'
import { loadEnv } from 'vite'

const e2eEnv = loadEnv('test', process.cwd(), '')
const e2eConfigured = Boolean(e2eEnv.E2E_SUPABASE_URL && e2eEnv.E2E_SUPABASE_ANON_KEY)

export const test = base.extend<{ e2eEnvCheck: void }>({
  e2eEnvCheck: [
    async ({}, use, testInfo) => {
      if (!e2eConfigured) testInfo.skip('E2E env not configured — copy .env.example to .env.test.local (see SETUP.md)')
      await use()
    },
    { auto: true },
  ],
})
export { expect }

export function randomEmail(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `herkules-e2e-${prefix}-${Date.now()}-${rand}@gmail.com`
}

export const TEST_PASSWORD = 'TestPassword123!'

/** Signs up a fresh user through the UI and lands on Today. */
export async function signUpFresh(page: Page, prefix = 'user'): Promise<string> {
  const email = randomEmail(prefix)
  await page.goto('/#/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password (min 8 characters)').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 20_000 })
  return email
}

/** Signs in an existing user through the UI. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 20_000 })
}

/** Waits until everything queued has been pushed (status badge in the top bar). */
export async function waitForAllSaved(page: Page): Promise<void> {
  await expect(page.locator('.app-topbar-status').getByText('All changes saved')).toBeVisible({
    timeout: 30_000,
  })
}

/** Expands a collapsed Settings accordion pane. */
export async function expandSettingsSection(
  page: Page,
  section: 'profile' | 'preferences' | 'weight' | 'sync' | 'data' | 'account',
): Promise<void> {
  const toggle = page.locator(`[data-settings-section="${section}"]`)
  await expect(toggle).toBeVisible()
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
  }
}

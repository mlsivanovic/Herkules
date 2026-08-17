// E2E: app shell checks — direct hash-route deep links, theme persistence,
// PWA installability basics (manifest + service worker + icons) and focus
// visibility for keyboard users.
import { test, expect, signUpFresh } from './fixtures'

test.describe('app shell', () => {
  test('deep link to a hash route works after a cold open', async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    // protected route redirects to login when signed out
    await page.goto('/#/calendar')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('keyboard focus is visible on controls', async ({ page }) => {
    await page.goto('/#/login')
    await page.getByLabel('Email').focus()
    await page.keyboard.press('Tab') // password field
    await page.keyboard.press('Tab') // sign in button
    const focused = page.locator(':focus')
    await expect(focused).toHaveAttribute('type', 'submit')
  })

  test('dark theme persists across reloads', async ({ page }) => {
    await signUpFresh(page, 'theme')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('system theme follows the device color scheme', async ({ page }) => {
    await signUpFresh(page, 'theme-sys')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByLabel('Theme').selectOption('system')
    await expect(page.getByLabel('Theme')).toHaveValue('system')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('top bar theme toggle overrides system and persists', async ({ page }) => {
    await signUpFresh(page, 'theme-ovr')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByLabel('Theme').selectOption('system')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByLabel('Theme')).toHaveValue('dark')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('PWA basics: manifest, icons and service worker are served', async ({ page, request }) => {
    const manifest = await request.get('/Herkules/manifest.webmanifest')
    expect(manifest.ok()).toBeTruthy()
    const body = (await manifest.json()) as { icons: { src: string }[] }
    expect(body.icons.length).toBeGreaterThanOrEqual(3)

    for (const icon of body.icons) {
      const iconResponse = await request.get(`/Herkules/${icon.src}`)
      expect(iconResponse.ok(), `icon ${icon.src} must be served`).toBeTruthy()
    }

    await page.goto('/#/login')
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const registration = await navigator.serviceWorker.getRegistration()
      return Boolean(registration)
    })
    expect(swReady, 'service worker must be registered in the production build').toBeTruthy()
  })
})

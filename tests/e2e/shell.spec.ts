// E2E: app shell checks — direct hash-route deep links, theme persistence,
// PWA installability basics (manifest + service worker + icons) and focus
// visibility for keyboard users.
import { test, expect, signUpFresh, expandSettingsSection } from './fixtures'

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

  test('language switch to Serbian updates chrome and html lang', async ({ page }) => {
    await signUpFresh(page, 'locale')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await expandSettingsSection(page, 'preferences')
    await page.getByLabel('Language').selectOption('sr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'sr-Latn')
    await expect(page.getByRole('link', { name: 'Danas' }).first()).toBeVisible()
    await page.getByLabel('Jezik').selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('link', { name: 'Today' }).first()).toBeVisible()
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
    await expandSettingsSection(page, 'preferences')
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
    await expandSettingsSection(page, 'preferences')
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

  test('update toast follows the current theme', async ({ page }) => {
    async function injectToast() {
      await page.evaluate(() => {
        document.getElementById('herkules-toast')?.remove()
        const wrap = document.createElement('div')
        wrap.className = 'toast-wrap'
        wrap.id = 'herkules-toast'
        const toast = document.createElement('div')
        toast.className = 'toast'
        const text = document.createElement('span')
        text.textContent = 'A new version is available.'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'btn btn--primary btn--small'
        button.textContent = 'Update'
        toast.append(text, button)
        wrap.appendChild(toast)
        document.body.appendChild(wrap)
      })
    }

    async function toastColors() {
      return page.locator('.toast').evaluate((el) => {
        const button = el.querySelector('button')
        if (!button) throw new Error('toast button missing')
        const toast = getComputedStyle(el)
        const action = getComputedStyle(button)
        return { toastBg: toast.backgroundColor, btnBg: action.backgroundColor }
      })
    }

    await page.goto('/#/login')
    await page.evaluate(() => localStorage.setItem('herkules:theme', 'light'))
    await page.reload()
    await injectToast()
    await expect.poll(toastColors).toEqual({
      toastBg: 'rgb(255, 255, 255)',
      btnBg: 'rgb(29, 78, 216)',
    })

    await page.evaluate(() => localStorage.setItem('herkules:theme', 'dark'))
    await page.reload()
    await injectToast()
    await expect.poll(toastColors).toEqual({
      toastBg: 'rgb(22, 32, 58)',
      btnBg: 'rgb(79, 131, 241)',
    })
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

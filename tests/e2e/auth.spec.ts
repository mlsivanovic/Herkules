// E2E: registration, session persistence, sign-out and login.
import { test, expect, signUpFresh, signIn, randomEmail } from './fixtures'

test.describe('auth', () => {
  test('sign up lands on Today and shows the system catalog', async ({ page }) => {
    await signUpFresh(page, 'auth')

    // The seed catalog arrives through RLS-protected reads
    await page.getByRole('link', { name: 'Exercises' }).click()
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()
    await expect(page.getByText('Barbell Back Squat')).toBeVisible()
    await expect(page.getByText('Treadmill Run')).toBeVisible()
  })

  test('session survives reload, sign out requires login again', async ({ page }) => {
    const email = await signUpFresh(page, 'persist')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    await signIn(page, email)
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  })

  test('wrong password shows an error', async ({ page }) => {
    const email = randomEmail('wrongpass')
    await signUpFresh(page, 'wrongpass')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()

    await page.goto('/#/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('CompletelyWrong1!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
  })
})

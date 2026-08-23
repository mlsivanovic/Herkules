// E2E: body-weight check-in on the Today home screen.
import { test, expect, signUpFresh } from './fixtures'

test.describe('weight check-in', () => {
  test('logs body weight for today from the home screen', async ({ page }) => {
    await signUpFresh(page, 'weight')

    await page.getByRole('button', { name: /Weight check-in/ }).click()
    await page.getByLabel(/Weight/).fill('82.5')
    await page.getByRole('button', { name: 'Save weigh-in' }).click()
    await expect(page.getByText('Saved')).toBeVisible()
    await expect(page.getByText('82.5 kg')).toBeVisible()

    await page.getByRole('button', { name: /Weight check-in/ }).click()
    await expect(page.getByRole('button', { name: /Weight check-in/ })).toContainText('82.5 kg')
  })
})

test.describe('body composition check-in', () => {
  test('logs tape measurements for today from the home screen', async ({ page }) => {
    await signUpFresh(page, 'body')

    await page.getByRole('button', { name: /Body composition check-in/ }).click()
    await page.getByLabel(/Neck/).fill('38')
    await page.getByLabel(/Waist/).fill('85')
    await page.getByRole('button', { name: 'Save check-in' }).click()
    await expect(page.getByText('Saved')).toBeVisible()
  })
})

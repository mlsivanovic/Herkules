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

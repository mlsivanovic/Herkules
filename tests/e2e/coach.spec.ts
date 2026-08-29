import { expect, expandSettingsSection, signUpFresh, test } from './fixtures'

test('coach mode opens the roster', async ({ page }) => {
  await signUpFresh(page, 'coach')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expandSettingsSection(page, 'account')
  await page.getByRole('button', { name: 'Enable coach mode' }).click()
  await page.getByRole('button', { name: 'Open coach roster' }).first().click()
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New client' })).toBeVisible()
})

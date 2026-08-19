// E2E: training plan as an ordered set of routines.
import { test, expect, signUpFresh } from './fixtures'

test.describe('training plans', () => {
  test('create a plan, assign a routine, see it grouped', async ({ page }) => {
    await signUpFresh(page, 'plans')

    await page.goto('/#/routines')
    await page.getByRole('button', { name: 'New plan' }).click()
    await page.getByLabel('Name').fill('E2E PPL')
    await page.getByRole('button', { name: 'Save plan' }).click()
    await expect(page.getByRole('heading', { name: 'Edit plan' })).toBeVisible()

    await page.getByRole('button', { name: 'New routine' }).click()
    await page.getByLabel('Name').fill('E2E Push')
    await expect(page.getByLabel('Training plan')).toHaveValue(/.+/)
    await page.getByRole('button', { name: 'Save routine' }).click()

    await expect(page.getByRole('heading', { name: 'Edit plan' })).toBeVisible()
    await expect(page.getByText('E2E Push')).toBeVisible()
    await expect(page.getByText('Day 1')).toBeVisible()

    await page.goto('/#/routines')
    await expect(page.getByText('E2E PPL')).toBeVisible()
    await expect(page.getByText('1 day')).toBeVisible()
    await expect(page.getByText('Every routine is in a plan')).toBeVisible()
  })
})

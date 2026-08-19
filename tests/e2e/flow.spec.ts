// E2E: the core planning + logging flow — custom exercise, routine, weekly
// schedule, workout with all measurement types, finish, history, progress.
import { test, expect, signUpFresh } from './fixtures'

test.describe('workout flow', () => {
  test('custom exercise, routine, weekly plan, workout, history, progress', async ({ page }) => {
    await signUpFresh(page, 'flow')

    // --- custom exercise -------------------------------------------------
    await page.goto('/#/exercises')
    await page.getByRole('button', { name: 'New' }).click()
    await page.getByLabel('Name').fill('E2E Landmine Press')
    await page.getByLabel('Category').selectOption('strength')
    await page.getByLabel('Measured by').selectOption('weight_reps')
    await page.getByLabel('Muscle groups (comma separated)').fill('shoulders, core')
    await page.getByRole('button', { name: 'Save exercise' }).click()
    await expect(page.getByText('E2E Landmine Press')).toBeVisible()
    await expect(page.getByText('Custom').first()).toBeVisible()

    // system exercise is read-only
    await page.getByRole('button', { name: /Barbell Back Squat/ }).click()
    await expect(page.getByText('System · read-only')).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()

    // --- routine ----------------------------------------------------------
    await page.goto('/#/routines')
    await page.getByRole('button', { name: 'New routine' }).click()
    await page.getByLabel('Name').fill('E2E Full Body')

    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByLabel('Search').fill('Landmine')
    await page.getByRole('button', { name: /E2E Landmine Press/ }).click()
    await page.getByLabel('Sets').fill('2')

    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByLabel('Search').fill('Jump Rope')
    await page.getByRole('button', { name: /Jump Rope/ }).click()

    await page.getByRole('button', { name: 'Save routine' }).click()
    await expect(page.getByText('E2E Full Body')).toBeVisible()

    // --- weekly schedule (defaults include today's weekday) ---------------
    await page.goto('/#/calendar')
    await page.getByRole('button', { name: 'Schedule' }).click()
    await page.getByLabel('Routine').selectOption({ label: 'E2E Full Body' })
    await page.getByRole('button', { name: 'Weekly' }).click()
    await page.getByRole('button', { name: 'Schedule' }).last().click()

    // today's cell should now carry the planned state
    const today = page.getByRole('gridcell', { name: /planned/ }).first()
    await expect(today).toBeVisible()
    await today.click()

    // --- start from calendar ----------------------------------------------
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'E2E Full Body' })).toBeVisible()
    await expect(page.getByText('E2E Landmine Press')).toBeVisible()
    await expect(page.getByText('Jump Rope')).toBeVisible()

    // --- log a weight_reps set --------------------------------------------
    const firstSet = page.getByRole('group', { name: 'Set 1 values' })
    await firstSet.getByLabel('Weight in kg').fill('32.5')
    await firstSet.getByLabel('Repetitions').fill('10')
    await page.getByRole('button', { name: 'Complete set 1' }).click()

    // rest timer starts automatically after a completed set
    await expect(page.getByText(/Rest/)).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()

    // --- log a duration set (Jump Rope) -----------------------------------
    const ropeSet = page
      .locator('.workout-exercise', { hasText: 'Jump Rope' })
      .getByRole('group', { name: 'Set 1 values' })
    await ropeSet.getByLabel(/Duration/).fill('5:00')
    await page
      .locator('.workout-exercise', { hasText: 'Jump Rope' })
      .getByRole('button', { name: 'Complete set 1' })
      .click()

    // --- finish ------------------------------------------------------------
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.getByLabel('Session RPE (1–10)').selectOption('7')
    await page.getByRole('button', { name: 'Finish workout' }).click()

    // history detail shows the completed session with both exercises
    await expect(page.getByText('2 sets done')).toBeVisible()
    await expect(page.getByText('E2E Landmine Press')).toBeVisible()

    // --- progress ----------------------------------------------------------
    await page.goto('/#/progress')
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
    await expect(page.getByText('Workouts')).toBeVisible()
    await expect(page.getByText('E2E Landmine Press').first()).toBeVisible()
    await expect(page.getByText('Heaviest').first()).toBeVisible()
  })

  test('distance_duration logging against the seed catalog', async ({ page }) => {
    await signUpFresh(page, 'cardio')

    await page.goto('/#/workout')
    await page.getByRole('button', { name: 'Empty workout' }).click()
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByLabel('Search').fill('Rowing')
    await page.getByRole('button', { name: /Rowing Machine/ }).click()

    const row = page.getByRole('group', { name: 'Set 1 values' })
    await row.getByLabel(/Duration/).fill('8:30')
    await row.getByLabel(/Distance in km/).fill('2.01')
    await page.getByRole('button', { name: 'Complete set 1' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()

    await page.getByRole('button', { name: 'Finish' }).click()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page.getByText('Rowing Machine')).toBeVisible()
  })
})

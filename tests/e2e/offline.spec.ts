// E2E: the offline acceptance scenario — start online, go offline, log and
// finish a workout, reload without data loss, reconnect and confirm sync.
import { test, expect, signUpFresh, waitForAllSaved } from './fixtures'

test.describe('offline first', () => {
  test('workout started online completes offline and syncs on reconnect', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'offline emulation is unreliable on webkit')

    await signUpFresh(page, 'offline')
    await waitForAllSaved(page) // catalog + profile fully synced before we cut the cord

    // start an empty workout while online
    await page.goto('/#/workout')
    await page.getByRole('button', { name: 'Empty workout' }).click()
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByLabel('Search').fill('Bench')
    await page.getByRole('button', { name: /Barbell Bench Press/ }).click()

    // --- go offline --------------------------------------------------------
    await context.setOffline(true)
    await expect(page.getByText('Offline', { exact: false })).toBeVisible()

    // log two sets offline — every change persists to IndexedDB immediately
    const set1 = page.getByRole('group', { name: 'Set 1 values' })
    await set1.getByLabel('Weight in kg').fill('60')
    await set1.getByLabel('Repetitions').fill('8')
    await page.getByRole('button', { name: 'Complete set 1' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()

    await page.getByRole('button', { name: 'Add set' }).click()
    const set2 = page.getByRole('group', { name: 'Set 2 values' })
    await set2.getByLabel('Weight in kg').fill('62.5')
    await set2.getByLabel('Repetitions').fill('6')
    await page.getByRole('button', { name: 'Complete set 2' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()

    // finish offline
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page.getByText('Barbell Bench Press')).toBeVisible()
    await expect(page.getByText('2 sets')).toBeVisible()

    // reload while offline — data must survive from IndexedDB, shell from SW
    await page.reload()
    await expect(page.getByText('Offline', { exact: false })).toBeVisible()
    await page.goto('/#/progress')
    await expect(page.getByText('Barbell Bench Press').first()).toBeVisible()

    // --- reconnect ----------------------------------------------------------
    await context.setOffline(false)
    await waitForAllSaved(page)

    // after a server round-trip the session is still there (pull confirms push)
    await page.reload()
    await page.goto('/#/progress')
    await expect(page.getByText('Barbell Bench Press').first()).toBeVisible()
    await expect(page.getByText('Workouts')).toBeVisible()
  })
})

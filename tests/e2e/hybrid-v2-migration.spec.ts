// E2E: seed a legacy four-day Hybrid plan through Supabase, let the app's
// first successful sync run the direct upgrader, then prove identity/history
// preservation and recipe idempotency against the real database schema.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { test, expect, signUpFresh, TEST_PASSWORD, waitForAllSaved } from './fixtures'

const env = loadEnv('test', process.cwd(), '')
const EXTERNAL_ROTATION = '11111111-1111-4111-8111-111111111217'
const KETTLEBELL_SWING = '11111111-1111-4111-8111-111111111155'

test.describe('Hybrid V1 → V2 direct migration', () => {
  test('preserves plan/template/history ids and is idempotent', async ({ page }) => {
    const email = await signUpFresh(page, 'hybrid-v2')
    const client = createClient(env.E2E_SUPABASE_URL, env.E2E_SUPABASE_ANON_KEY)
    const { error: authError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
    expect(authError).toBeNull()

    const planId = crypto.randomUUID()
    const templateIds = Object.fromEntries(
      ['A', 'B', 'C', 'D'].map((slot) => [slot, crypto.randomUUID()]),
    ) as Record<'A' | 'B' | 'C' | 'D', string>
    const now = new Date().toISOString()

    const { error: planError } = await client.from('training_plans').insert({
      id: planId,
      name: 'Hybrid 4-day',
      notes: 'Legacy V1 migration probe',
      source_key: 'hybrid-4-day',
      source_version: 1,
    })
    expect(planError).toBeNull()

    const { error: templateError } = await client.from('workout_templates').insert(
      (['A', 'B', 'C', 'D'] as const).map((slot, position) => ({
        id: templateIds[slot],
        name: `Hybrid ${slot} — Legacy V1`,
        notes: `Program: Hybrid 4-day ${slot} · V1`,
        plan_id: planId,
        plan_position: position,
      })),
    )
    expect(templateError).toBeNull()

    const legacyItemIds = (['A', 'B', 'C', 'D'] as const).map(() => crypto.randomUUID())
    const { error: itemError } = await client.from('template_items').insert(
      (['A', 'B', 'C', 'D'] as const).map((slot, position) => ({
        id: legacyItemIds[position],
        template_id: templateIds[slot],
        exercise_id: EXTERNAL_ROTATION,
        position: 0,
        planned_sets: 1,
        target_reps: 12,
        tempo: '2-0-2',
      })),
    )
    expect(itemError).toBeNull()

    const sessionId = crypto.randomUUID()
    const sessionExerciseId = crypto.randomUUID()
    const setId = crypto.randomUUID()
    const { error: sessionError } = await client.from('workout_sessions').insert({
      id: sessionId,
      template_id: templateIds.A,
      name: 'Historical Hybrid A',
      status: 'completed',
      started_at: now,
      ended_at: now,
      notes: 'Must remain an immutable snapshot',
      rpe: 7,
    })
    expect(sessionError).toBeNull()
    const { error: sessionExerciseError } = await client.from('session_exercises').insert({
      id: sessionExerciseId,
      session_id: sessionId,
      exercise_id: EXTERNAL_ROTATION,
      name_snapshot: 'Legacy External Rotation',
      measurement_snapshot: 'weight_reps',
      position: 0,
      planned_sets: 1,
      tempo: '2-0-2',
    })
    expect(sessionExerciseError).toBeNull()
    const { error: setError } = await client.from('workout_sets').insert({
      id: setId,
      session_exercise_id: sessionExerciseId,
      position: 1,
      weight_kg: 4,
      reps: 12,
      rpe: 7,
      completed_at: now,
    })
    expect(setError).toBeNull()

    // Pull the seeded V1 hierarchy and allow the debounced direct upgrade to flush.
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Retry sync' }).click()
    await waitForAllSaved(page)

    const first = await readRecipe(client, planId, templateIds)
    expect(first.plan?.id).toBe(planId)
    expect(first.plan?.source_version).toBe(3)
    expect(first.templates.map((row) => row.id)).toEqual([
      templateIds.A, templateIds.B, templateIds.C, templateIds.D,
    ])
    expect(first.blocks).toHaveLength(23)
    expect(first.items).toHaveLength(43)
    expect(first.items.filter((row) => row.template_id === templateIds.C)).toHaveLength(12)
    expect(first.items.some((row) =>
      row.template_id === templateIds.C && row.exercise_id === KETTLEBELL_SWING,
    )).toBe(true)
    expect(first.items.every((row) => row.tempo !== null && row.tempo_eccentric !== null)).toBe(true)
    expect(first.items.some((row) => legacyItemIds.includes(row.id))).toBe(false)

    const historical = await client
      .from('workout_sessions')
      .select('id, name, notes, rpe, session_exercises(id, name_snapshot, measurement_snapshot, workout_sets(id, weight_kg, reps, rpe, completed_at))')
      .eq('id', sessionId)
      .single()
    expect(historical.error).toBeNull()
    expect(historical.data).toMatchObject({
      id: sessionId,
      name: 'Historical Hybrid A',
      notes: 'Must remain an immutable snapshot',
      rpe: 7,
      session_exercises: [{
        id: sessionExerciseId,
        name_snapshot: 'Legacy External Rotation',
        measurement_snapshot: 'weight_reps',
        workout_sets: [{ id: setId, weight_kg: 4, reps: 12, rpe: 7, completed_at: now }],
      }],
    })

    // A second sync must recognize the canonical recipe and create nothing.
    await page.getByRole('button', { name: 'Retry sync' }).click()
    await waitForAllSaved(page)
    const second = await readRecipe(client, planId, templateIds)
    expect(second.blocks.map((row) => row.id).sort()).toEqual(first.blocks.map((row) => row.id).sort())
    expect(second.items.map((row) => row.id).sort()).toEqual(first.items.map((row) => row.id).sort())
  })
})

async function readRecipe(
  client: ReturnType<typeof createClient>,
  planId: string,
  templateIds: Record<'A' | 'B' | 'C' | 'D', string>,
) {
  const ids = [templateIds.A, templateIds.B, templateIds.C, templateIds.D]
  const [plan, templates, blocks, items] = await Promise.all([
    client.from('training_plans').select('*').eq('id', planId).single(),
    client.from('workout_templates').select('*').eq('plan_id', planId).order('plan_position'),
    client.from('template_blocks').select('*').in('template_id', ids).order('position'),
    client.from('template_items').select('*').in('template_id', ids).order('position'),
  ])
  expect(plan.error).toBeNull()
  expect(templates.error).toBeNull()
  expect(blocks.error).toBeNull()
  expect(items.error).toBeNull()
  return {
    plan: plan.data,
    templates: templates.data ?? [],
    blocks: blocks.data ?? [],
    items: items.data ?? [],
  }
}

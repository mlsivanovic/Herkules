// RLS integration proof: two users, one anonymous client.
// Verifies that no user can read or modify another user's data across all
// nine tables and that system exercises are readable but immutable.
//
// Requirements for the test project (see SETUP.md):
//   - migrations applied (supabase db push)
//   - "Confirm email" DISABLED so signUp returns a session immediately
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.E2E_SUPABASE_URL
const anonKey = process.env.E2E_SUPABASE_ANON_KEY

describe.skipIf(!url || !anonKey)('Row Level Security (two users)', () => {
  let alice: SupabaseClient
  let bob: SupabaseClient
  let anon: SupabaseClient

  const aliceIds = {
    exercise: '',
    template: '',
    item: '',
    session: '',
    sessionExercise: '',
    set: '',
    schedule: '',
    rule: '',
    checkin: '',
  }

  async function signUp(name: string): Promise<SupabaseClient> {
    const client = createClient(url!, anonKey!)
    const email = `herkules-rls-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
    const { data, error } = await client.auth.signUp({ email, password: 'TestPassword123!' })
    expect(error, `signUp failed: ${error?.message}`).toBeNull()
    if (!data.session) {
      throw new Error(
        'signUp returned no session — disable "Confirm email" on the TEST project (see SETUP.md).',
      )
    }
    return client
  }

  beforeAll(async () => {
    alice = await signUp('alice')
    bob = await signUp('bob')
    anon = createClient(url!, anonKey!)
  })

  afterAll(async () => {
    // Best-effort cleanup of data (test users remain in the test project Auth;
    // remove them from the dashboard or with the service key if desired).
    await alice?.from('workout_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await alice?.from('tendon_checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await alice?.from('schedule_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await alice?.from('recurrence_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await alice?.from('workout_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await alice?.from('exercises').delete().eq('name', 'RLS Probe Exercise')
    await bob?.from('exercises').delete().eq('name', 'RLS Probe Exercise (Bob)')
  })

  describe('setup data as Alice', () => {
    it('creates a full owned hierarchy', async () => {
      const { data: exercise, error: exError } = await alice.from('exercises').insert({
        name: 'RLS Probe Exercise',
        category: 'strength',
        measurement: 'weight_reps',
      }).select().single()
      expect(exError).toBeNull()
      aliceIds.exercise = exercise.id

      const { data: template, error: tplError } = await alice
        .from('workout_templates')
        .insert({ name: 'RLS Probe Routine' })
        .select()
        .single()
      expect(tplError).toBeNull()
      aliceIds.template = template.id

      const { data: item, error: itemError } = await alice
        .from('template_items')
        .insert({ template_id: template.id, exercise_id: exercise.id, position: 0 })
        .select()
        .single()
      expect(itemError).toBeNull()
      aliceIds.item = item.id

      const { data: session, error: sesError } = await alice
        .from('workout_sessions')
        .insert({ name: 'RLS Probe Session' })
        .select()
        .single()
      expect(sesError).toBeNull()
      aliceIds.session = session.id

      const { data: se, error: seError } = await alice
        .from('session_exercises')
        .insert({
          session_id: session.id,
          exercise_id: exercise.id,
          name_snapshot: 'RLS Probe Exercise',
          measurement_snapshot: 'weight_reps',
        })
        .select()
        .single()
      expect(seError).toBeNull()
      aliceIds.sessionExercise = se.id

      const { error: setError } = await alice.from('workout_sets').insert({
        session_exercise_id: se.id,
        position: 1,
        weight_kg: 100,
        reps: 5,
      })
      expect(setError).toBeNull()

      const { data: rule, error: ruleError } = await alice
        .from('recurrence_rules')
        .insert({ weekdays: [1, 3], start_date: '2026-01-05' })
        .select()
        .single()
      expect(ruleError).toBeNull()
      aliceIds.rule = rule.id

      const { error: scheduleError } = await alice.from('schedule_items').insert({
        template_id: template.id,
        recurrence_rule_id: rule.id,
      })
      expect(scheduleError).toBeNull()
    })

    it('creates a tendon check-in', async () => {
      const { data, error } = await alice
        .from('tendon_checkins')
        .insert({
          recorded_on: '2026-08-19',
          site: 'Knee L',
          stiffness: 3,
          pain: 2,
          notes: 'morning stiffness',
        })
        .select()
        .single()
      expect(error).toBeNull()
      aliceIds.checkin = data.id
    })

    it('rejects invalid data at the database level', async () => {
      const { error: negative } = await alice.from('workout_sets').insert({
        session_exercise_id: aliceIds.sessionExercise,
        position: 2,
        weight_kg: -5,
        reps: 3,
      })
      expect(negative?.message).toContain('check')

      const { error: badRpe } = await alice.from('workout_sessions').update({ rpe: 42 }).eq('id', aliceIds.session)
      expect(badRpe?.message).toContain('check')

      const { error: badUrl } = await alice
        .from('exercises')
        .update({ video_url: 'http://insecure.example' })
        .eq('id', aliceIds.exercise)
      expect(badUrl?.message).toContain('check')

      // second concurrent active session must violate the partial unique index
      const { error: active } = await alice.from('workout_sessions').insert({ name: 'Second active' })
      expect(active?.message).toContain('uq_sessions_active')
    })
  })

  describe('Bob cannot touch Alice data', () => {
    it('cannot read Alice exercises, templates, items', async () => {
      const { data: ex } = await bob.from('exercises').select().eq('id', aliceIds.exercise)
      expect(ex).toHaveLength(0)

      const { data: tpl } = await bob.from('workout_templates').select().eq('id', aliceIds.template)
      expect(tpl).toHaveLength(0)

      const { data: items } = await bob.from('template_items').select().eq('id', aliceIds.item)
      expect(items).toHaveLength(0)
    })

    it('cannot read Alice sessions, exercises, sets', async () => {
      const { data: sessions } = await bob.from('workout_sessions').select().eq('id', aliceIds.session)
      expect(sessions).toHaveLength(0)

      const { data: ses } = await bob.from('session_exercises').select().eq('id', aliceIds.sessionExercise)
      expect(ses).toHaveLength(0)

      const { data: sets } = await bob
        .from('workout_sets')
        .select()
        .eq('session_exercise_id', aliceIds.sessionExercise)
      expect(sets).toHaveLength(0)
    })

    it('cannot write Alice rows (RLS violation errors)', async () => {
      const { error: tplUpdate } = await bob
        .from('workout_templates')
        .update({ name: 'Hacked' })
        .eq('id', aliceIds.template)
      expect(tplUpdate).toBeTruthy()
      expect(tplUpdate?.code).toBe('42501')

      const { error: setInsert } = await bob.from('workout_sets').insert({
        session_exercise_id: aliceIds.sessionExercise,
        position: 9,
      })
      expect(setInsert?.code).toBe('42501')

      const { error: sessionDelete } = await bob.from('workout_sessions').delete().eq('id', aliceIds.session)
      expect(sessionDelete?.code).toBe('42501')

      // upsert path (what the sync queue uses) must also be blocked
      const { error: upsert } = await bob
        .from('workout_sets')
        .upsert({ id: '00000000-0000-4000-8000-000000000001', session_exercise_id: aliceIds.sessionExercise, position: 1 })
      expect(upsert?.code).toBe('42501')
    })

    it('cannot read Alice schedule and rules', async () => {
      const { data: rules } = await bob.from('recurrence_rules').select().eq('id', aliceIds.rule)
      expect(rules).toHaveLength(0)
      const { data: schedules } = await bob
        .from('schedule_items')
        .select()
        .eq('template_id', aliceIds.template)
      expect(schedules).toHaveLength(0)
    })

    it('cannot read or write Alice tendon check-ins', async () => {
      const { data } = await bob.from('tendon_checkins').select().eq('id', aliceIds.checkin)
      expect(data).toHaveLength(0)
      const { error } = await bob
        .from('tendon_checkins')
        .update({ pain: 10 })
        .eq('id', aliceIds.checkin)
      expect(error).toBeDefined()
    })

    it('cannot read or edit Alice profile', async () => {
      const { data: profiles } = await bob.from('profiles').select()
      const aliceUserId = (await alice.from('profiles').select().single()).data?.id
      expect(profiles?.some((p) => p.id === aliceUserId)).toBe(false)
    })
  })

  describe('system exercises', () => {
    it('are readable by every authenticated user', async () => {
      const { data, error } = await alice.from('exercises').select().is('owner_id', null)
      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThanOrEqual(15)

      const { data: bobView } = await bob.from('exercises').select().is('owner_id', null)
      expect(bobView?.length).toBe(data?.length)
    })

    it('cannot be modified by anyone', async () => {
      const first = (await alice.from('exercises').select().is('owner_id', null).limit(1)).data?.[0]
      expect(first).toBeTruthy()

      const { error: update } = await alice
        .from('exercises')
        .update({ name: 'Hijacked' })
        .eq('id', first!.id)
      expect(update?.code).toBe('42501')

      const { error: insert } = await alice.from('exercises').insert({
        name: 'Fake system exercise',
        category: 'strength',
        measurement: 'reps',
        owner_id: null,
      })
      expect(insert?.code).toBe('42501')
    })
  })

  describe('anonymous access', () => {
    it('gets nothing from every table', async () => {
      const tables = [
        'profiles',
        'exercises',
        'workout_templates',
        'template_items',
        'recurrence_rules',
        'schedule_items',
        'workout_sessions',
        'session_exercises',
        'workout_sets',
      ]
      for (const table of tables) {
        const { error } = await anon.from(table).select().limit(1)
        expect(error, `${table} must deny anon access`).toBeTruthy()
        expect(error?.code).toBe('42501')
      }
    })
  })

  describe('Bob owns his own data', () => {
    it('can create and see exactly his own exercise', async () => {
      const { data, error } = await bob
        .from('exercises')
        .insert({ name: 'RLS Probe Exercise (Bob)', category: 'cardio', measurement: 'duration' })
        .select()
        .single()
      expect(error).toBeNull()
      const id = data?.id ?? ''

      const { data: bobList } = await bob.from('exercises').select().eq('id', id)
      expect(bobList).toHaveLength(1)

      const { data: aliceList } = await alice.from('exercises').select().eq('id', id)
      expect(aliceList).toHaveLength(0)

      const { error: deleteError } = await bob.from('exercises').delete().eq('id', id)
      expect(deleteError).toBeTruthy() // no DELETE grant — archive is the flow
    })
  })
})

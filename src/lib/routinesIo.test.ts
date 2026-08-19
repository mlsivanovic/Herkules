import { describe, expect, it } from 'vitest'
import type { ExerciseRow, TemplateItemRow, TemplateRow } from '../types/db'
import { serializeBackup } from './backup'
import {
  parseRoutines,
  planRoutineImport,
  ROUTINES_FORMAT,
  serializeRoutines,
} from './routinesIo'

const NOW = '2026-08-19T12:00:00.000Z'

const bench: ExerciseRow = {
  id: '11111111-1111-4111-8111-111111111301',
  owner_id: null,
  name: 'Barbell Bench Press',
  category: 'strength',
  measurement: 'weight_reps',
  muscle_groups: ['chest'],
  equipment: ['barbell'],
  instructions: null,
  video_url: null,
  is_archived: false,
  created_at: NOW,
  updated_at: NOW,
}

const curl: ExerciseRow = {
  id: '11111111-1111-4111-8111-111111111302',
  owner_id: 'u1',
  name: 'My Special Curl',
  category: 'strength',
  measurement: 'weight_reps',
  muscle_groups: ['biceps'],
  equipment: ['dumbbell'],
  instructions: 'Slow eccentrics',
  video_url: null,
  is_archived: false,
  created_at: NOW,
  updated_at: NOW,
}

const template: TemplateRow = {
  id: '11111111-1111-4111-8111-111111111101',
  owner_id: 'u1',
  name: 'Push',
  notes: 'Upper body',
  created_at: NOW,
  updated_at: NOW,
}

const items: TemplateItemRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111201',
    template_id: template.id,
    exercise_id: bench.id,
    position: 0,
    planned_sets: 4,
    target_weight_kg: 80,
    target_reps: 5,
    target_duration_s: null,
    target_distance_m: null,
    rest_seconds: 150,
    tempo: '3-0-1',
    notes: 'pause at chest',
    superset_group: '11111111-1111-4111-8111-111111111401',
    block_role: 'gym',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: '11111111-1111-4111-8111-111111111202',
    template_id: template.id,
    exercise_id: curl.id,
    position: 1,
    planned_sets: 3,
    target_weight_kg: 12,
    target_reps: 12,
    target_duration_s: null,
    target_distance_m: null,
    rest_seconds: 60,
    tempo: null,
    notes: null,
    superset_group: '11111111-1111-4111-8111-111111111401',
    block_role: 'tendon',
    created_at: NOW,
    updated_at: NOW,
  },
]

describe('routines JSON', () => {
  it('round-trips a routine with system and custom exercises', () => {
    const json = serializeRoutines([template], items, [bench, curl])
    const file = parseRoutines(json)
    expect(file.format).toBe(ROUTINES_FORMAT)
    expect(file.routines).toHaveLength(1)
    const routine = file.routines[0]
    expect(routine?.name).toBe('Push')
    expect(routine?.notes).toBe('Upper body')
    expect(routine?.items).toHaveLength(2)
    expect(routine?.items[0]?.exercise.name).toBe('Barbell Bench Press')
    expect(routine?.items[0]?.tempo).toBe('3-0-1')
    expect(routine?.items[1]?.block_role).toBe('tendon')
    expect(routine?.items[1]?.exercise.name).toBe('My Special Curl')
  })

  it('drops items whose exercise is missing from the catalog', () => {
    const json = serializeRoutines([template], items, [bench])
    const file = parseRoutines(json)
    expect(file.routines[0]?.items).toHaveLength(1)
    expect(file.routines[0]?.items[0]?.exercise.name).toBe('Barbell Bench Press')
  })

  it('rejects invalid JSON and foreign formats', () => {
    expect(() => parseRoutines('not json {')).toThrow(/not valid JSON/)
    expect(() => parseRoutines('{"format":"nope"}')).toThrow(/not a Herkules routines export/)
    const backup = serializeBackup({
      profile: null,
      bodyWeights: [],
      exercises: [],
      templates: [],
      templateItems: [],
      rules: [],
      schedules: [],
      sessions: [],
      checkins: [],
    })
    expect(() => parseRoutines(backup)).toThrow(/full backup/)
  })

  it('rejects a newer file version', () => {
    const json = serializeRoutines([template], items, [bench, curl]).replace(
      '"version": 1',
      '"version": 99',
    )
    expect(() => parseRoutines(json)).toThrow(/newer version/)
  })

  it('matches catalog exercises and creates missing custom ones', () => {
    const file = parseRoutines(serializeRoutines([template], items, [bench, curl]))
    let n = 0
    const plan = planRoutineImport({
      file,
      catalog: [bench],
      existingTemplates: [],
      existingItems: [],
      ownerId: 'u2',
      now: NOW,
      newId: () => `22222222-2222-4222-8222-22222222200${(n += 1)}`,
    })
    expect(plan.createdTemplates).toBe(1)
    expect(plan.updatedTemplates).toBe(0)
    expect(plan.newExercises).toHaveLength(1)
    expect(plan.newExercises[0]?.name).toBe('My Special Curl')
    expect(plan.newExercises[0]?.owner_id).toBe('u2')
    expect(plan.items[0]?.exercise_id).toBe(bench.id)
    expect(plan.items[1]?.exercise_id).toBe(plan.newExercises[0]?.id)
  })

  it('re-import updates the same routine and does not recreate a custom exercise', () => {
    const file = parseRoutines(serializeRoutines([template], items, [bench, curl]))
    const first = planRoutineImport({
      file,
      catalog: [bench],
      existingTemplates: [],
      existingItems: [],
      ownerId: 'u2',
      now: NOW,
      newId: () => '22222222-2222-4222-8222-222222222001',
    })
    const custom = first.newExercises[0]
    expect(custom).toBeDefined()
    if (!custom) return
    const second = planRoutineImport({
      file,
      catalog: [bench, custom],
      existingTemplates: first.templates,
      existingItems: first.items,
      ownerId: 'u2',
      now: '2026-08-20T12:00:00.000Z',
      newId: () => {
        throw new Error('should not mint new ids on re-import')
      },
    })
    expect(second.createdTemplates).toBe(0)
    expect(second.updatedTemplates).toBe(1)
    expect(second.newExercises).toHaveLength(0)
    expect(second.itemIdsToDelete).toHaveLength(0)
    expect(second.items[1]?.exercise_id).toBe(custom?.id)
  })

  it('deletes items that were removed from the exported routine', () => {
    const firstItem = items[0]
    expect(firstItem).toBeDefined()
    if (!firstItem) return
    const json = serializeRoutines([template], [firstItem], [bench])
    const file = parseRoutines(json)
    const plan = planRoutineImport({
      file,
      catalog: [bench, curl],
      existingTemplates: [template],
      existingItems: items,
      ownerId: 'u1',
      now: NOW,
      newId: () => 'should-not-run',
    })
    expect(plan.updatedTemplates).toBe(1)
    expect(plan.items).toHaveLength(1)
    expect(plan.itemIdsToDelete).toEqual(['11111111-1111-4111-8111-111111111202'])
  })
})

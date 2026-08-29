// Copy a trainer's plan (templates, blocks, items, custom exercises) into a
// client's account. Sessions stay snapshots; this only writes programming rows.

import type {
  ExerciseRow,
  TemplateBlockRow,
  TemplateItemRow,
  TemplateRow,
  TrainingPlanRow,
} from '../types/db'

export interface AssignablePlan {
  plan: TrainingPlanRow
  templates: TemplateRow[]
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
  exercises: ExerciseRow[]
}

export interface AssignCopy {
  plan: TrainingPlanRow
  templates: TemplateRow[]
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
  exercises: ExerciseRow[]
}

export function copyPlanToClient(input: {
  source: AssignablePlan
  trainerId: string
  clientId: string
  now: string
  newId: () => string
}): AssignCopy {
  const { source, trainerId, clientId, now, newId } = input
  const planId = newId()
  const exerciseMap = new Map<string, string>()
  const templateMap = new Map<string, string>()
  const blockMap = new Map<string, string>()

  const exercises: ExerciseRow[] = []
  for (const exercise of source.exercises) {
    if (exercise.owner_id == null) continue
    const id = newId()
    exerciseMap.set(exercise.id, id)
    exercises.push({
      ...exercise,
      id,
      owner_id: clientId,
      assigned_by: trainerId,
      source_exercise_id: exercise.id,
      locked: true,
      created_at: now,
      updated_at: now,
    })
  }

  const templates = [...source.templates]
    .sort((a, b) => a.plan_position - b.plan_position || a.id.localeCompare(b.id))
    .map((template, index) => {
      const id = newId()
      templateMap.set(template.id, id)
      return {
        ...template,
        id,
        owner_id: clientId,
        plan_id: planId,
        plan_position: index,
        assigned_by: trainerId,
        source_template_id: template.id,
        locked: true,
        created_at: now,
        updated_at: now,
      }
    })

  const blocks = source.blocks
    .filter((block) => templateMap.has(block.template_id))
    .map((block) => {
      const id = newId()
      blockMap.set(block.id, id)
      return {
        ...block,
        id,
        template_id: templateMap.get(block.template_id) ?? block.template_id,
        created_at: now,
        updated_at: now,
      }
    })

  const items = source.items
    .filter((item) => templateMap.has(item.template_id))
    .map((item) => ({
      ...item,
      id: newId(),
      template_id: templateMap.get(item.template_id) ?? item.template_id,
      exercise_id: exerciseMap.get(item.exercise_id) ?? item.exercise_id,
      block_id: item.block_id ? blockMap.get(item.block_id) ?? item.block_id : item.block_id,
      created_at: now,
      updated_at: now,
    }))

  const plan: TrainingPlanRow = {
    ...source.plan,
    id: planId,
    owner_id: clientId,
    assigned_by: trainerId,
    source_plan_id: source.plan.id,
    locked: true,
    created_at: now,
    updated_at: now,
  }

  return { plan, templates, blocks, items, exercises }
}

export function assignedFromTrainer<T extends { assigned_by?: string | null; locked?: boolean }>(
  rows: T[],
  trainerId: string,
): T[] {
  return rows.filter((row) => row.locked === true && row.assigned_by === trainerId)
}

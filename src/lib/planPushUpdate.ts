// Push a trainer's current master plan onto an existing client copy.
// Completed / in-progress sessions are snapshots and are never rewritten.
// If the copy cannot be matched to the master, the caller should replace.

import { copyPlanToClient, type AssignablePlan, type AssignCopy } from './coachAssign'
import type { TemplateRow } from '../types/db'

export type PushUpdateResult =
  | { kind: 'updated'; copy: AssignCopy; added: number; removed: number; updated: number }
  | { kind: 'replace' }

export function applyPlanPushUpdate(input: {
  master: AssignablePlan
  copy: AssignablePlan
  trainerId: string
  clientId: string
  now: string
  newId: () => string
  inProgressTemplateIds?: Iterable<string>
}): PushUpdateResult {
  const { master, copy, trainerId, clientId, now, newId } = input
  if (copy.plan.source_plan_id !== master.plan.id) return { kind: 'replace' }
  if (copy.plan.assigned_by !== trainerId) return { kind: 'replace' }

  const busy = new Set(input.inProgressTemplateIds ?? [])
  const masterBySource = new Map(master.templates.map((row) => [row.id, row]))
  const copyBySource = new Map(
    copy.templates
      .filter((row) => row.source_template_id)
      .map((row) => [row.source_template_id as string, row]),
  )

  const templates: TemplateRow[] = []
  let added = 0
  let updated = 0
  let removed = 0

  const fresh = copyPlanToClient({
    source: master,
    trainerId,
    clientId,
    now,
    newId,
  })

  // Reuse existing copy ids so schedule_items / session.template_id stay valid.
  const templateIdMap = new Map<string, string>()
  const blockIdMap = new Map<string, string>()

  for (const masterTpl of [...master.templates].sort(
    (a, b) => a.plan_position - b.plan_position || a.id.localeCompare(b.id),
  )) {
    const existing = copyBySource.get(masterTpl.id)
    const freshTpl = fresh.templates.find((row) => row.source_template_id === masterTpl.id)
    if (!freshTpl) continue
    if (existing) {
      if (busy.has(existing.id)) {
        templates.push(existing)
        templateIdMap.set(masterTpl.id, existing.id)
        continue
      }
      templates.push({
        ...freshTpl,
        id: existing.id,
        plan_id: copy.plan.id,
        plan_position: masterTpl.plan_position,
        created_at: existing.created_at,
      })
      templateIdMap.set(masterTpl.id, existing.id)
      updated += 1
    } else {
      templates.push({ ...freshTpl, plan_id: copy.plan.id, plan_position: masterTpl.plan_position })
      templateIdMap.set(masterTpl.id, freshTpl.id)
      added += 1
    }
  }

  for (const existing of copy.templates) {
    const sourceId = existing.source_template_id
    if (sourceId && masterBySource.has(sourceId)) continue
    if (busy.has(existing.id)) {
      templates.push(existing)
      continue
    }
    removed += 1
  }

  const blocks = fresh.blocks.map((block) => {
    const sourceTemplate = fresh.templates.find((row) => row.id === block.template_id)
    const masterTemplateId = sourceTemplate?.source_template_id
    const destTemplateId = masterTemplateId ? templateIdMap.get(masterTemplateId) : undefined
    const id = newId()
    blockIdMap.set(block.id, id)
    return {
      ...block,
      id,
      template_id: destTemplateId ?? block.template_id,
    }
  })

  const items = fresh.items.map((item) => {
    const sourceTemplate = fresh.templates.find((row) => row.id === item.template_id)
    const masterTemplateId = sourceTemplate?.source_template_id
    const destTemplateId = masterTemplateId ? templateIdMap.get(masterTemplateId) : undefined
    const destBlockId = item.block_id ? blockIdMap.get(item.block_id) ?? item.block_id : item.block_id
    return {
      ...item,
      id: newId(),
      template_id: destTemplateId ?? item.template_id,
      block_id: destBlockId,
    }
  })

  // Drop items/blocks for templates skipped because a session is in progress.
  const skipped = copy.templates.filter((row) => busy.has(row.id)).map((row) => row.id)
  const skipSet = new Set(skipped)
  const liveBlocks = [
    ...copy.blocks.filter((block) => skipSet.has(block.template_id)),
    ...blocks.filter((block) => !skipSet.has(block.template_id)),
  ]
  const existingExerciseId = new Map(
    copy.exercises
      .filter((exercise) => exercise.source_exercise_id)
      .map((exercise) => [exercise.source_exercise_id as string, exercise.id]),
  )
  const exerciseIdMap = new Map<string, string>()
  const exercises = fresh.exercises.map((exercise) => {
    const keepId = exercise.source_exercise_id
      ? existingExerciseId.get(exercise.source_exercise_id)
      : undefined
    if (keepId) {
      exerciseIdMap.set(exercise.id, keepId)
      const previous = copy.exercises.find((row) => row.id === keepId)
      return { ...exercise, id: keepId, created_at: previous?.created_at ?? exercise.created_at }
    }
    return exercise
  })

  const remappedItems = items.map((row) => ({
    ...row,
    exercise_id: exerciseIdMap.get(row.exercise_id) ?? row.exercise_id,
  }))

  const liveItems = [
    ...copy.items.filter((item) => skipSet.has(item.template_id)),
    ...remappedItems.filter((item) => !skipSet.has(item.template_id)),
  ]

  return {
    kind: 'updated',
    added,
    removed,
    updated,
    copy: {
      plan: {
        ...copy.plan,
        name: master.plan.name,
        notes: master.plan.notes,
        updated_at: now,
      },
      templates,
      blocks: liveBlocks,
      items: liveItems,
      exercises,
    },
  }
}

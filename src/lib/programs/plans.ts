// Pure helpers for training-plan membership. Store I/O lives in store.tsx.

import type { SessionDoc, TemplateRow, TrainingPlanRow } from '../../types/db'
import { hybridSlotFromTemplate } from './hybrid4day'
import type { HybridSlot } from './rotate'

export const HYBRID_PLAN_NAME = 'Hybrid 4-day'

export const HYBRID_PLAN_NOTES =
  'Health, strength, function, and tendon work. Four days (A–D): back squat, trap bar, dips, TRX. ~65–80 min, mostly RPE 7–8. Do not run C and D on consecutive days.'

export function sortPlanTemplates<T extends { id: string; plan_id: string | null; plan_position: number }>(
  templates: T[],
  planId: string,
): T[] {
  return templates
    .filter((row) => row.plan_id === planId)
    .sort((a, b) => a.plan_position - b.plan_position || a.id.localeCompare(b.id))
}

export function nextPlanPosition(
  templates: { plan_id: string | null; plan_position: number }[],
  planId: string,
): number {
  let max = -1
  for (const row of templates) {
    if (row.plan_id === planId && row.plan_position > max) max = row.plan_position
  }
  return max + 1
}

export function compactPlanPositions<T extends { id: string; plan_id: string | null; plan_position: number }>(
  templates: T[],
  planId: string,
): T[] {
  return sortPlanTemplates(templates, planId).map((row, index) =>
    row.plan_position === index ? row : { ...row, plan_position: index },
  )
}

export function unassignedTemplates<T extends { plan_id: string | null }>(templates: T[]): T[] {
  return templates.filter((row) => !row.plan_id)
}

/** Newer extras that share a plan + source_slot with an older keeper. */
export function extraDuplicateSlotTemplates<T extends {
  id: string
  plan_id: string | null
  source_slot?: string | null
  created_at: string
}>(templates: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const row of templates) {
    if (!row.plan_id || !row.source_slot) continue
    const key = `${row.plan_id}:${row.source_slot}`
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  const extras: T[] = []
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const ranked = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    extras.push(...ranked.slice(1))
  }
  return extras
}

export function hybridPlanFrom(plans: TrainingPlanRow[]): TrainingPlanRow | null {
  return plans.find((plan) => plan.source_key === 'hybrid-4-day')
    ?? plans.find((plan) => plan.name === HYBRID_PLAN_NAME)
    ?? null
}

export function planBySourceKey(
  plans: TrainingPlanRow[],
  sourceKey: string,
): TrainingPlanRow | null {
  return plans.find((plan) => plan.source_key === sourceKey) ?? null
}

/** Existing Hybrid A–D templates that are not yet attached to a shared plan. */
export function orphanHybridTemplates(templates: TemplateRow[]): TemplateRow[] | null {
  const bySlot: Partial<Record<HybridSlot, TemplateRow>> = {}
  for (const template of templates) {
    const slot = hybridSlotFromTemplate(template)
    if (slot) bySlot[slot] = template
  }
  if (!bySlot.A || !bySlot.B || !bySlot.C || !bySlot.D) return null
  const ordered = [bySlot.A, bySlot.B, bySlot.C, bySlot.D]
  const planIds = new Set(ordered.map((row) => row.plan_id).filter((id): id is string => Boolean(id)))
  if (planIds.size === 1) return null
  return ordered
}

export function applyHybridPlanMembership(input: {
  plan: TrainingPlanRow
  templates: TemplateRow[]
  now: string
}): TemplateRow[] {
  const orphans = orphanHybridTemplates(input.templates)
  if (!orphans) return []
  return orphans.map((template, index) => ({
    ...template,
    plan_id: input.plan.id,
    plan_position: index,
    updated_at: input.now,
  }))
}

/** Dynamic plan occurrence: only completed sessions started from a plan slot
 * advance the sequence. Skips and manually-started routines do not. */
export function nextTemplateForPlan(
  planId: string,
  templates: TemplateRow[],
  sessions: SessionDoc[],
): TemplateRow | null {
  const days = sortPlanTemplates(templates, planId)
  if (days.length === 0) return null
  const completed = sessions.filter(
    (session) => session.plan_id === planId && session.status === 'completed',
  ).length
  return days[completed % days.length] ?? days[0] ?? null
}

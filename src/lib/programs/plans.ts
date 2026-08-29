// Pure helpers for training-plan membership. Store I/O lives in store.tsx.

import type { PlanRoutineRow, SessionDoc, TemplateRow, TrainingPlanRow } from '../../types/db'
import { hybridSlotFromTemplate } from './hybrid4day'
import type { HybridSlot } from './rotate'

export type PlanMembership = Pick<PlanRoutineRow, 'plan_id' | 'template_id' | 'position'>

export const HYBRID_PLAN_NAME = 'Hybrid 4-day'

export const HYBRID_PLAN_NOTES =
  'Health, strength, function, and tendon work. Four days (A–D): back squat, trap bar, dips, TRX. ~65–80 min, mostly RPE 7–8. Do not run C and D on consecutive days.'

export function sortPlanTemplates<T extends { id: string; plan_id: string | null; plan_position: number }>(
  templates: T[],
  planId: string,
  memberships?: PlanMembership[],
): T[] {
  if (memberships) {
    const forPlan = memberships
      .filter((row) => row.plan_id === planId)
      .sort((a, b) => a.position - b.position || a.template_id.localeCompare(b.template_id))
    if (forPlan.length > 0) {
      const byId = new Map(templates.map((row) => [row.id, row]))
      const result: T[] = []
      const seen = new Set<string>()
      for (const member of forPlan) {
        const template = byId.get(member.template_id)
        if (!template || seen.has(template.id)) continue
        result.push(template)
        seen.add(template.id)
      }
      return result
    }
  }
  return templates
    .filter((row) => row.plan_id === planId)
    .sort((a, b) => a.plan_position - b.plan_position || a.id.localeCompare(b.id))
}

export function nextPlanPosition(
  templates: { plan_id: string | null; plan_position: number }[],
  planId: string,
  memberships?: PlanMembership[],
): number {
  if (memberships) {
    let max = -1
    let found = false
    for (const row of memberships) {
      if (row.plan_id !== planId) continue
      found = true
      if (row.position > max) max = row.position
    }
    if (found) return max + 1
  }
  let max = -1
  for (const row of templates) {
    if (row.plan_id === planId && row.plan_position > max) max = row.plan_position
  }
  return max + 1
}

export function compactPlanPositions<T extends { id: string; plan_id: string | null; plan_position: number }>(
  templates: T[],
  planId: string,
  memberships?: PlanMembership[],
): T[] {
  return sortPlanTemplates(templates, planId, memberships).map((row, index) =>
    row.plan_position === index ? row : { ...row, plan_position: index },
  )
}

export function compactMemberships<T extends PlanMembership>(memberships: T[], planId: string): T[] {
  return memberships
    .filter((row) => row.plan_id === planId)
    .sort((a, b) => a.position - b.position || a.template_id.localeCompare(b.template_id))
    .map((row, index) => (row.position === index ? row : { ...row, position: index }))
}

export function unassignedTemplates<T extends { id: string; plan_id: string | null }>(
  templates: T[],
  memberships?: PlanMembership[],
): T[] {
  if (!memberships) return templates.filter((row) => !row.plan_id)
  const assigned = new Set(memberships.map((row) => row.template_id))
  return templates.filter((row) => !assigned.has(row.id) && !row.plan_id)
}

/** Trainer-created routines (not starter days, not locked coach copies). */
export function isPoolTemplate(template: { source_slot?: string | null; locked?: boolean }): boolean {
  return template.locked !== true && !template.source_slot
}

export function poolTemplates<T extends { source_slot?: string | null; locked?: boolean }>(templates: T[]): T[] {
  return templates.filter(isPoolTemplate)
}

export function templatePlanIds(
  templateId: string,
  memberships: PlanMembership[],
  fallbackPlanId?: string | null,
): string[] {
  const ids = [...new Set(memberships.filter((row) => row.template_id === templateId).map((row) => row.plan_id))]
  if (ids.length > 0) return ids
  return fallbackPlanId ? [fallbackPlanId] : []
}

export function missingPlanMemberships(
  templates: { id: string; plan_id: string | null; plan_position: number }[],
  memberships: PlanMembership[],
): PlanMembership[] {
  const have = new Set(memberships.map((row) => `${row.plan_id}:${row.template_id}`))
  const missing: PlanMembership[] = []
  for (const row of templates) {
    if (!row.plan_id) continue
    const key = `${row.plan_id}:${row.id}`
    if (have.has(key)) continue
    missing.push({ plan_id: row.plan_id, template_id: row.id, position: row.plan_position })
  }
  return missing
}

/** Keep one membership per plan+routine so sync cannot unique-conflict. */
export function extraDuplicateMemberships<T extends PlanMembership & { id: string }>(
  memberships: T[],
): T[] {
  const keep = new Set<string>()
  const extras: T[] = []
  const ranked = [...memberships].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  )
  for (const row of ranked) {
    const key = `${row.plan_id}:${row.template_id}`
    if (keep.has(key)) extras.push(row)
    else keep.add(key)
  }
  return extras
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
  memberships?: PlanMembership[],
): TemplateRow | null {
  const days = sortPlanTemplates(templates, planId, memberships)
  if (days.length === 0) return null
  const completed = sessions.filter(
    (session) => session.plan_id === planId && session.status === 'completed',
  ).length
  return days[completed % days.length] ?? days[0] ?? null
}

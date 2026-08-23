import type { TemplateRow, TrainingPlanRow } from '../../types/db'
import { BUILD_PLAN_NAME, BUILD_PLAN_NOTES, BUILD_SOURCE_KEY, BUILD_SOURCE_VERSION, BUILD_TEMPLATES } from './build4day'
import { BUSY_PLAN_NAME, BUSY_PLAN_NOTES, BUSY_SOURCE_KEY, BUSY_SOURCE_VERSION, BUSY_TEMPLATES } from './busy3day'
import { FOUNDATIONS_PLAN_NAME, FOUNDATIONS_PLAN_NOTES, FOUNDATIONS_SOURCE_KEY, FOUNDATIONS_SOURCE_VERSION, FOUNDATIONS_TEMPLATES } from './foundations3day'
import { HOME2_PLAN_NAME, HOME2_PLAN_NOTES, HOME2_SOURCE_KEY, HOME2_SOURCE_VERSION, HOME2_TEMPLATES } from './home2day'
import { HOME_PLAN_NAME, HOME_PLAN_NOTES, HOME_SOURCE_KEY, HOME_SOURCE_VERSION, HOME_TEMPLATES } from './home3day'
import {
  HYBRID_PLAN_NAME,
  HYBRID_PLAN_NOTES,
  planBySourceKey,
} from './plans'
import {
  HYBRID_SOURCE_KEY,
  HYBRID_SOURCE_VERSION,
  HYBRID_TEMPLATES,
  hybridTemplatesFrom,
} from './hybrid4day'
import { LONGEVITY_PLAN_NAME, LONGEVITY_PLAN_NOTES, LONGEVITY_SOURCE_KEY, LONGEVITY_SOURCE_VERSION, LONGEVITY_TEMPLATES } from './longevity3day'
import { templatesBySlot, type DaySlot, type ProgramTemplate } from './recipe'
import { STREET_PLAN_NAME, STREET_PLAN_NOTES, STREET_SOURCE_KEY, STREET_SOURCE_VERSION, STREET_TEMPLATES } from './street3day'

export type StarterCopyKey =
  | 'hybrid'
  | 'foundations'
  | 'home'
  | 'home2'
  | 'street'
  | 'busy'
  | 'build'
  | 'longevity'

export type StarterEquipment = 'gym' | 'home' | 'home_bar' | 'street' | 'machines'

export interface StarterProgram {
  sourceKey: string
  sourceVersion: number
  copyKey: StarterCopyKey
  planName: string
  planNotes: string
  equipment: StarterEquipment
  durationMin: number
  durationMax: number
  templates: ProgramTemplate[]
}

export const STARTER_PROGRAMS: StarterProgram[] = [
  {
    sourceKey: HYBRID_SOURCE_KEY,
    sourceVersion: HYBRID_SOURCE_VERSION,
    copyKey: 'hybrid',
    planName: HYBRID_PLAN_NAME,
    planNotes: HYBRID_PLAN_NOTES,
    equipment: 'gym',
    durationMin: 65,
    durationMax: 80,
    templates: HYBRID_TEMPLATES,
  },
  {
    sourceKey: FOUNDATIONS_SOURCE_KEY,
    sourceVersion: FOUNDATIONS_SOURCE_VERSION,
    copyKey: 'foundations',
    planName: FOUNDATIONS_PLAN_NAME,
    planNotes: FOUNDATIONS_PLAN_NOTES,
    equipment: 'gym',
    durationMin: 45,
    durationMax: 55,
    templates: FOUNDATIONS_TEMPLATES,
  },
  {
    sourceKey: HOME_SOURCE_KEY,
    sourceVersion: HOME_SOURCE_VERSION,
    copyKey: 'home',
    planName: HOME_PLAN_NAME,
    planNotes: HOME_PLAN_NOTES,
    equipment: 'home',
    durationMin: 40,
    durationMax: 50,
    templates: HOME_TEMPLATES,
  },
  {
    sourceKey: HOME2_SOURCE_KEY,
    sourceVersion: HOME2_SOURCE_VERSION,
    copyKey: 'home2',
    planName: HOME2_PLAN_NAME,
    planNotes: HOME2_PLAN_NOTES,
    equipment: 'home_bar',
    durationMin: 55,
    durationMax: 70,
    templates: HOME2_TEMPLATES,
  },
  {
    sourceKey: STREET_SOURCE_KEY,
    sourceVersion: STREET_SOURCE_VERSION,
    copyKey: 'street',
    planName: STREET_PLAN_NAME,
    planNotes: STREET_PLAN_NOTES,
    equipment: 'street',
    durationMin: 45,
    durationMax: 60,
    templates: STREET_TEMPLATES,
  },
  {
    sourceKey: BUSY_SOURCE_KEY,
    sourceVersion: BUSY_SOURCE_VERSION,
    copyKey: 'busy',
    planName: BUSY_PLAN_NAME,
    planNotes: BUSY_PLAN_NOTES,
    equipment: 'gym',
    durationMin: 30,
    durationMax: 40,
    templates: BUSY_TEMPLATES,
  },
  {
    sourceKey: BUILD_SOURCE_KEY,
    sourceVersion: BUILD_SOURCE_VERSION,
    copyKey: 'build',
    planName: BUILD_PLAN_NAME,
    planNotes: BUILD_PLAN_NOTES,
    equipment: 'gym',
    durationMin: 50,
    durationMax: 65,
    templates: BUILD_TEMPLATES,
  },
  {
    sourceKey: LONGEVITY_SOURCE_KEY,
    sourceVersion: LONGEVITY_SOURCE_VERSION,
    copyKey: 'longevity',
    planName: LONGEVITY_PLAN_NAME,
    planNotes: LONGEVITY_PLAN_NOTES,
    equipment: 'machines',
    durationMin: 45,
    durationMax: 60,
    templates: LONGEVITY_TEMPLATES,
  },
]

export function starterBySourceKey(sourceKey: string): StarterProgram | null {
  return STARTER_PROGRAMS.find((program) => program.sourceKey === sourceKey) ?? null
}

export function starterSlots(program: StarterProgram): DaySlot[] {
  return program.templates.map((row) => row.slot)
}

export { planBySourceKey }

export function installedStarterTemplates(
  program: StarterProgram,
  templates: TemplateRow[],
  plan: TrainingPlanRow | null,
): Partial<Record<DaySlot, TemplateRow>> | null {
  if (program.sourceKey === HYBRID_SOURCE_KEY) {
    return hybridTemplatesFrom(templates)
  }
  const scoped = plan
    ? templates.filter((row) => row.plan_id === plan.id)
    : templates.filter((row) => starterSlots(program).includes((row.source_slot ?? '') as DaySlot))
  return templatesBySlot(scoped, starterSlots(program))
}

export function isStarterInstalled(
  program: StarterProgram,
  plans: TrainingPlanRow[],
  templates: TemplateRow[],
): boolean {
  const plan = planBySourceKey(plans, program.sourceKey)
  if (plan) return true
  if (program.sourceKey === HYBRID_SOURCE_KEY) return hybridTemplatesFrom(templates) !== null
  return false
}

export function equipmentCopyKey(
  equipment: StarterEquipment,
): 'starters.equipmentGym' | 'starters.equipmentHome' | 'starters.equipmentHomeBar' | 'starters.equipmentStreet' | 'starters.equipmentMachines' {
  if (equipment === 'home') return 'starters.equipmentHome'
  if (equipment === 'home_bar') return 'starters.equipmentHomeBar'
  if (equipment === 'street') return 'starters.equipmentStreet'
  if (equipment === 'machines') return 'starters.equipmentMachines'
  return 'starters.equipmentGym'
}

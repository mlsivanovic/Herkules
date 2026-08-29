// Feature flags derived from the signed-in profile. UI hides, store throws,
// RLS still owns the real boundary.

import type { AccountKind, ProfileRow } from '../types/db'

export interface Capabilities {
  kind: AccountKind
  isCoach: boolean
  canCreateRoutines: boolean
  canCreateExercises: boolean
  canStartEmptyWorkout: boolean
  canImportExport: boolean
  canEnableCoach: boolean
  canEditUnlockedRoutines: boolean
  canRemoveCoachSchedule: boolean
  canRestructureWorkout: boolean
  navRoutines: boolean
  navExercises: boolean
  navCoach: boolean
}

const FULL: Capabilities = {
  kind: 'full',
  isCoach: false,
  canCreateRoutines: true,
  canCreateExercises: true,
  canStartEmptyWorkout: true,
  canImportExport: true,
  canEnableCoach: true,
  canEditUnlockedRoutines: true,
  canRemoveCoachSchedule: true,
  canRestructureWorkout: true,
  navRoutines: true,
  navExercises: true,
  navCoach: false,
}

const LIGHT: Capabilities = {
  kind: 'light',
  isCoach: false,
  canCreateRoutines: false,
  canCreateExercises: false,
  canStartEmptyWorkout: false,
  canImportExport: false,
  canEnableCoach: false,
  canEditUnlockedRoutines: false,
  canRemoveCoachSchedule: false,
  canRestructureWorkout: false,
  navRoutines: false,
  navExercises: false,
  navCoach: false,
}

export function accountKindOf(profile: Pick<ProfileRow, 'account_kind'> | null | undefined): AccountKind {
  return profile?.account_kind === 'light' ? 'light' : 'full'
}

export function isLightAccount(profile: Pick<ProfileRow, 'account_kind'> | null | undefined): boolean {
  return accountKindOf(profile) === 'light'
}

export function capabilitiesFor(
  profile: Pick<ProfileRow, 'account_kind' | 'is_coach'> | null | undefined,
): Capabilities {
  if (accountKindOf(profile) === 'light') return LIGHT
  const isCoach = profile?.is_coach === true
  return { ...FULL, isCoach, navCoach: isCoach }
}

export function assertCapability(allowed: boolean, message: string): void {
  if (!allowed) throw new Error(message)
}

/** Light clients only see currently assigned (locked) programming. */
export function programmingForAccount<T extends { locked?: boolean }>(
  rows: T[],
  profile: Pick<ProfileRow, 'account_kind'> | null | undefined,
): T[] {
  if (!isLightAccount(profile)) return rows
  return rows.filter((row) => row.locked === true)
}

/** Athletes start only locked routines that belong to an assigned plan. */
export function startableProgrammingForAccount<
  P extends { id: string; locked?: boolean },
  T extends { plan_id: string | null; locked?: boolean },
>(
  plans: P[],
  templates: T[],
  profile: Pick<ProfileRow, 'account_kind'> | null | undefined,
): { plans: P[]; templates: T[] } {
  const visiblePlans = programmingForAccount(plans, profile)
  const visibleTemplates = programmingForAccount(templates, profile)
  if (!isLightAccount(profile)) return { plans: visiblePlans, templates: visibleTemplates }
  const planIds = new Set(visiblePlans.map((plan) => plan.id))
  return {
    plans: visiblePlans,
    templates: visibleTemplates.filter((row) => row.plan_id != null && planIds.has(row.plan_id)),
  }
}

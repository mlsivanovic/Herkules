/** Weekly moderate aerobic minutes. WHO baseline is 150; coaches may assign 1–2000. */

export const DEFAULT_AEROBIC_GOAL_MINUTES = 150
export const MIN_AEROBIC_GOAL_MINUTES = 1
export const MAX_AEROBIC_GOAL_MINUTES = 2000

export function clampAerobicGoalMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AEROBIC_GOAL_MINUTES
  return Math.min(MAX_AEROBIC_GOAL_MINUTES, Math.max(MIN_AEROBIC_GOAL_MINUTES, Math.round(value)))
}

export function resolveAerobicGoalMinutes(value: number | null | undefined): number {
  return clampAerobicGoalMinutes(value ?? DEFAULT_AEROBIC_GOAL_MINUTES)
}

export function aerobicGoalSeconds(minutes: number | null | undefined): number {
  return resolveAerobicGoalMinutes(minutes) * 60
}

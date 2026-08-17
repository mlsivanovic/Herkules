// Closed set: how this slot is used in a routine. Independent of catalog category.

export type ExerciseBlockRole = 'gym' | 'cardio' | 'tendon'

export const BLOCK_ROLES: { value: ExerciseBlockRole; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'tendon', label: 'Tendon' },
]

export function normalizeBlockRole(value: unknown): ExerciseBlockRole {
  return value === 'cardio' || value === 'tendon' ? value : 'gym'
}

export function blockRoleClass(value: unknown): string {
  return `block-role--${normalizeBlockRole(value)}`
}

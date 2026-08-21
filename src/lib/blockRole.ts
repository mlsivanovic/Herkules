// Closed set: how this slot is used in a routine. Independent of catalog category.
import { t } from './i18n'

export type ExerciseBlockRole = 'gym' | 'cardio' | 'tendon'

export function blockRoleLabel(value: ExerciseBlockRole): string {
  return t(`blockRole.${value}`)
}

export const BLOCK_ROLES: { value: ExerciseBlockRole; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'tendon', label: 'Tendon' },
]

export function blockRoles(): { value: ExerciseBlockRole; label: string }[] {
  return [
    { value: 'gym', label: blockRoleLabel('gym') },
    { value: 'cardio', label: blockRoleLabel('cardio') },
    { value: 'tendon', label: blockRoleLabel('tendon') },
  ]
}

export function normalizeBlockRole(value: unknown): ExerciseBlockRole {
  return value === 'cardio' || value === 'tendon' ? value : 'gym'
}

export function blockRoleClass(value: unknown): string {
  return `block-role--${normalizeBlockRole(value)}`
}

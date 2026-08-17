import { describe, expect, it } from 'vitest'
import { blockRoleClass, normalizeBlockRole } from './blockRole'

describe('block roles', () => {
  it('defaults unknown values to gym', () => {
    expect(normalizeBlockRole(undefined)).toBe('gym')
    expect(normalizeBlockRole('tendon')).toBe('tendon')
    expect(normalizeBlockRole('cardio')).toBe('cardio')
  })

  it('maps to a css modifier', () => {
    expect(blockRoleClass('cardio')).toBe('block-role--cardio')
  })
})

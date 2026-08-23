import { describe, expect, it } from 'vitest'
import { SYS } from './programs/exercises'
import {
  formatSetLoad,
  isBodyweightLoad,
  isBodyweightLoadExercise,
} from './bodyweightLoad'

describe('isBodyweightLoadExercise', () => {
  it('matches pull-up and dip catalog ids', () => {
    expect(isBodyweightLoadExercise({ id: SYS.pullUp, name: 'Other' })).toBe(true)
    expect(isBodyweightLoadExercise({ id: SYS.chinUp })).toBe(true)
    expect(isBodyweightLoadExercise({ id: SYS.dip })).toBe(true)
    expect(isBodyweightLoadExercise({ id: SYS.pushUp })).toBe(true)
    expect(isBodyweightLoadExercise({ id: SYS.barbellBenchPress, name: 'Bench' })).toBe(false)
  })

  it('matches pull-up / dip names for custom or snapshot rows', () => {
    expect(isBodyweightLoadExercise({ name: 'Pull-Up' })).toBe(true)
    expect(isBodyweightLoadExercise({ name: 'Weighted Chin Up' })).toBe(true)
    expect(isBodyweightLoadExercise({ name: 'Dip' })).toBe(true)
    expect(isBodyweightLoadExercise({ name: 'Chest Dips' })).toBe(true)
    expect(isBodyweightLoadExercise({ name: 'Dead Hang' })).toBe(false)
    expect(isBodyweightLoadExercise({ name: 'Diamond Push-Up' })).toBe(false)
  })
})

describe('isBodyweightLoad', () => {
  it('treats empty and zero as bodyweight', () => {
    expect(isBodyweightLoad(null)).toBe(true)
    expect(isBodyweightLoad(0)).toBe(true)
    expect(isBodyweightLoad(10)).toBe(false)
  })
})

describe('formatSetLoad', () => {
  it('renders bodyweight or added load for pull-up style movements', () => {
    expect(formatSetLoad(null, 'metric', true)).toBe('BW')
    expect(formatSetLoad(0, 'metric', true)).toBe('BW')
    expect(formatSetLoad(10, 'metric', true)).toBe('+10 kg')
  })

  it('renders ordinary bar load otherwise', () => {
    expect(formatSetLoad(null, 'metric', false)).toBe('–')
    expect(formatSetLoad(80, 'metric', false)).toBe('80 kg')
  })
})

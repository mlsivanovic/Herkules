import { describe, expect, it } from 'vitest'
import { barOptionsFor, denominationsFor, platesForTarget } from './plates'

describe('platesForTarget', () => {
  const metric = denominationsFor('metric')

  it('loads 100 kg on a 20 kg bar as 25 + 15 per side', () => {
    const result = platesForTarget(100, 20, metric)
    expect(result.belowBar).toBe(false)
    expect(result.remainder).toBe(0)
    expect(result.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
    ])
  })

  it('breaks 102.5 kg into 25 + 15 + 1.25 per side', () => {
    const result = platesForTarget(102.5, 20, metric)
    expect(result.remainder).toBe(0)
    expect(result.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
      { weight: 1.25, count: 1 },
    ])
  })

  it('reports the remainder for unreachable targets', () => {
    const result = platesForTarget(101.8, 20, metric)
    expect(result.remainder).toBeCloseTo(0.9, 5)
    expect(result.perSide.length).toBeGreaterThan(0)
  })

  it('flags targets below the empty bar', () => {
    const result = platesForTarget(10, 20, metric)
    expect(result.belowBar).toBe(true)
    expect(result.perSide).toEqual([])
  })

  it('handles imperial denominations', () => {
    const result = platesForTarget(135, 45, denominationsFor('imperial'))
    expect(result.remainder).toBe(0)
    expect(result.perSide).toEqual([{ weight: 45, count: 1 }])
  })

  it('always returns denominations largest first', () => {
    expect(denominationsFor('metric')).toEqual([25, 20, 15, 10, 5, 2.5, 1.25])
    expect(barOptionsFor('imperial')[0].weight).toBe(45)
  })
})

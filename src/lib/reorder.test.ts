import { describe, expect, it } from 'vitest'
import { indexAtClientY, moveIndex, sortByPosition, supersetPartners } from './reorder'

describe('moveIndex', () => {
  it('moves an item to a new index', () => {
    expect(moveIndex(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveIndex(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('returns the same array when the move is a no-op', () => {
    const items = ['a', 'b']
    expect(moveIndex(items, 1, 1)).toBe(items)
    expect(moveIndex(items, -1, 0)).toBe(items)
    expect(moveIndex(items, 0, 5)).toBe(items)
  })
})

describe('sortByPosition', () => {
  it('restores order after a nested pull returns rows by primary key', () => {
    const rows = [
      { id: 'c', position: 2 },
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
    ]
    expect(sortByPosition(rows).map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(rows.map((row) => row.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('indexAtClientY', () => {
  // Tall, short, tall — the shape of expanded workout cards around a collapsed one.
  const rects = [
    { top: 0, bottom: 600 },
    { top: 600, bottom: 680 },
    { top: 680, bottom: 1280 },
  ]

  it('keeps the pointer on the tall card it is actually over', () => {
    expect(indexAtClientY(rects, 500)).toBe(0)
    expect(indexAtClientY(rects, 900)).toBe(2)
  })

  it('selects the short card only when the pointer is on it', () => {
    expect(indexAtClientY(rects, 640)).toBe(1)
  })

  it('uses the nearest edge when the pointer is in a gap or past the list', () => {
    expect(indexAtClientY(rects, -20)).toBe(0)
    expect(indexAtClientY(rects, 1400)).toBe(2)
  })
})

describe('supersetPartners', () => {
  const a = { id: '1', name: 'A', superset_group: 'g1' }
  const b = { id: '2', name: 'B', superset_group: 'g1' }
  const c = { id: '3', name: 'C', superset_group: 'g1' }
  const d = { id: '4', name: 'D', superset_group: null }
  const e = { id: '5', name: 'E', superset_group: 'orphan' }
  const items = [a, b, c, d, e]

  it('lists the other names in the same group', () => {
    expect(supersetPartners(items, b, (item) => item.name)).toEqual(['A', 'C'])
  })

  it('returns nothing for ungrouped or orphaned items', () => {
    expect(supersetPartners(items, d, (item) => item.name)).toEqual([])
    expect(supersetPartners(items, e, (item) => item.name)).toEqual([])
  })
})

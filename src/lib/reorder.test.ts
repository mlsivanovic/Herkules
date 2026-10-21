import { describe, expect, it } from 'vitest'
import {
  indexAtClientY,
  moveIndex,
  sortByPosition,
  supersetPartners,
  toggleSupersetWithNext,
} from './reorder'

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

describe('toggleSupersetWithNext', () => {
  const noBlocks = new Set<string>()
  let seq = 0
  const newGroup = () => `group-${++seq}`

  it('pairs an ungrouped item with the next one', () => {
    const items = [
      { superset_group: null, block_id: null },
      { superset_group: null, block_id: null },
      { superset_group: null, block_id: null },
    ]
    const next = toggleSupersetWithNext(items, 0, noBlocks, newGroup)
    expect(next[0]?.superset_group).not.toBeNull()
    expect(next[0]?.superset_group).toBe(next[1]?.superset_group)
    expect(next[2]?.superset_group).toBeNull()
  })

  it('pairs an item that sits in a straight V2 block', () => {
    const items = [
      { superset_group: null, block_id: 'straight-1' },
      { superset_group: null, block_id: 'straight-2' },
    ]
    const next = toggleSupersetWithNext(items, 0, noBlocks, newGroup)
    expect(next[0]?.superset_group).toBe(next[1]?.superset_group)
    expect(next[0]?.block_id).toBe('straight-1')
  })

  it('removing a member detaches it and its lone block partner', () => {
    const items = [
      { superset_group: null, block_id: 'superset-block' },
      { superset_group: null, block_id: 'superset-block' },
      { superset_group: null, block_id: 'straight-3' },
    ]
    const next = toggleSupersetWithNext(items, 1, new Set(['superset-block']), newGroup)
    // Item 1 was grouped with item 0, so this is a removal.
    expect(next[1]?.block_id).toBeNull()
    expect(next[1]?.superset_group).toBeNull()
    // The block is left with one member, which is detached too.
    expect(next[0]?.block_id).toBeNull()
  })

  it('forms a pair with the next item even when it is in a grouped block', () => {
    const items = [
      { superset_group: null, block_id: null },
      { superset_group: null, block_id: 'superset-block' },
      { superset_group: null, block_id: 'superset-block' },
    ]
    const next = toggleSupersetWithNext(items, 0, new Set(['superset-block']), newGroup)
    expect(next[0]?.superset_group).not.toBeNull()
    expect(next[0]?.superset_group).toBe(next[1]?.superset_group)
    expect(next[1]?.block_id).toBeNull()
    // The old block partner is not left alone in a superset block.
    expect(next[2]?.block_id).toBeNull()
  })

  it('removes an item from a legacy superset and clears a lone remainder', () => {
    const items = [
      { superset_group: 'g1', block_id: null },
      { superset_group: 'g1', block_id: null },
      { superset_group: null, block_id: null },
    ]
    const next = toggleSupersetWithNext(items, 0, noBlocks, newGroup)
    expect(next.map((row) => row.superset_group)).toEqual([null, null, null])
  })

  it('is a no-op for the last item', () => {
    const items = [
      { superset_group: null, block_id: null },
      { superset_group: null, block_id: null },
    ]
    const next = toggleSupersetWithNext(items, 1, noBlocks, newGroup)
    expect(next.map((row) => row.superset_group)).toEqual([null, null])
  })
})

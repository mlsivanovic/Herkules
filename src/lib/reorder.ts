/** Move the item at `from` to index `to`. Returns the same array if the
 * indices are equal or out of range. */
export function moveIndex<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items
  }
  const next = items.slice()
  const [item] = next.splice(from, 1)
  if (item === undefined) return items
  next.splice(to, 0, item)
  return next
}

/** Visual order for nested rows. Nested PostgREST selects do not order by
 * `position`, so a pull would otherwise scramble a just-reordered list. */
export function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.position - b.position)
}

/** List index whose vertical band contains `clientY`. Gaps (and space
 * above/below the list) fall back to the nearest band by edge, not midpoint,
 * so a tall expanded card does not steal drops from a short neighbour. */
export function indexAtClientY(
  rects: readonly ({ top: number; bottom: number } | null | undefined)[],
  clientY: number,
): number {
  if (rects.length === 0) return 0
  let nearest = 0
  let nearestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i]
    if (!rect) continue
    if (clientY >= rect.top && clientY <= rect.bottom) return i
    const dist = clientY < rect.top ? rect.top - clientY : clientY - rect.bottom
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = i
    }
  }
  return nearest
}

/**
 * Toggle "superset with next" for the item at `index`.
 *
 * Grouping has two sources: a legacy `superset_group` shared by 2+ items,
 * and a structured block (`block_id`) whose format is not `straight`
 * (the caller passes those block ids as `groupedBlockIds`). Forming a
 * superset always writes a legacy group and detaches both items from a
 * grouped block, so the pair takes effect even for program exercises that
 * arrived inside a V2 block. Removing an item detaches it and clears a
 * group/block that would otherwise be left with a single member.
 * The last item has no next exercise, so toggling it on is a no-op.
 */
export function toggleSupersetWithNext<
  T extends { superset_group: string | null; block_id?: string | null },
>(items: readonly T[], index: number, groupedBlockIds: ReadonlySet<string>, createGroupId: () => string): T[] {
  const item = items[index]
  if (!item) return [...items]
  const inGroupedBlock = (row: T) => row.block_id != null && groupedBlockIds.has(row.block_id)
  const blockMembers = item.block_id
    ? items.filter((row) => row.block_id === item.block_id)
    : []
  const legacyMembers = item.superset_group
    ? items.filter((row) => row.superset_group === item.superset_group)
    : []
  const grouped =
    (inGroupedBlock(item) && blockMembers.length >= 2) || legacyMembers.length >= 2

  if (grouped) {
    const next = items.map((row) => {
      if (row === item) {
        return {
          ...row,
          superset_group: null,
          block_id: inGroupedBlock(row) ? null : row.block_id,
        }
      }
      // A group left with one member is no group at all.
      if (item.superset_group && row.superset_group === item.superset_group && legacyMembers.length === 2) {
        return { ...row, superset_group: null }
      }
      if (item.block_id && row.block_id === item.block_id && blockMembers.length === 2) {
        return { ...row, block_id: null }
      }
      return row
    })
    return next
  }

  const partner = items[index + 1]
  if (!partner) return [...items]
  const group = partner.superset_group ?? item.superset_group ?? createGroupId()
  const partnerBlockId = partner.block_id
  return items.map((row) => {
    if (row === item || row === partner) {
      return {
        ...row,
        superset_group: group,
        block_id: inGroupedBlock(row) ? null : row.block_id,
      }
    }
    // Detaching the partner can orphan the last member of its old block.
    if (
      partnerBlockId &&
      groupedBlockIds.has(partnerBlockId) &&
      row.block_id === partnerBlockId &&
      items.filter((candidate) => candidate.block_id === partnerBlockId).length === 2
    ) {
      return { ...row, block_id: null }
    }
    return row
  })
}

/** Other members of the same superset/circuit, or an empty list when the
 * current item is ungrouped or is the only member. */
export function supersetPartners<T extends { superset_group: string | null }>(
  items: T[],
  current: T,
  nameOf: (item: T) => string,
): string[] {
  if (!current.superset_group) return []
  const group = items.filter((item) => item.superset_group === current.superset_group)
  if (group.length < 2) return []
  return group.filter((item) => item !== current).map(nameOf)
}

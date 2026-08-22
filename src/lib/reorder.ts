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

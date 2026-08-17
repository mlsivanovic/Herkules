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

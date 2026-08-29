// Deep-copy a routine (template + blocks + items) into a trainer-owned pool
// routine: unlocked, no starter slot, not attached to a plan.

import type { TemplateBlockRow, TemplateItemRow, TemplateRow } from '../types/db'

export function cloneRoutine(input: {
  template: TemplateRow
  items: TemplateItemRow[]
  blocks: TemplateBlockRow[]
  ownerId: string
  now: string
  newId: () => string
  name: string
}): { template: TemplateRow; items: TemplateItemRow[]; blocks: TemplateBlockRow[] } {
  const templateId = input.newId()
  const blockMap = new Map<string, string>()
  const groupMap = new Map<string, string>()

  const template: TemplateRow = {
    ...input.template,
    id: templateId,
    owner_id: input.ownerId,
    name: input.name,
    plan_id: null,
    plan_position: 0,
    source_slot: null,
    assigned_by: null,
    source_template_id: null,
    locked: false,
    created_at: input.now,
    updated_at: input.now,
  }

  const blocks = input.blocks
    .filter((block) => block.template_id === input.template.id)
    .map((block) => {
      const id = input.newId()
      blockMap.set(block.id, id)
      return {
        ...block,
        id,
        template_id: templateId,
        created_at: input.now,
        updated_at: input.now,
      }
    })

  const items = input.items
    .filter((item) => item.template_id === input.template.id)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((item) => {
      let group = item.superset_group
      if (group) {
        const mapped = groupMap.get(group) ?? input.newId()
        groupMap.set(group, mapped)
        group = mapped
      }
      return {
        ...item,
        id: input.newId(),
        template_id: templateId,
        block_id: item.block_id ? blockMap.get(item.block_id) ?? null : item.block_id,
        superset_group: group,
        created_at: input.now,
        updated_at: input.now,
      }
    })

  return { template, items, blocks }
}

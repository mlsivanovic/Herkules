import type {
  ExerciseBlockRole,
  TemplateBlockRow,
  TemplateItemRow,
  TemplateRow,
  TrainingPlanRow,
} from '../../types/db'
import { SYS } from './exercises'
import {
  asDaySlot,
  buildProgramRows,
  buildProgramUpgrade,
  controlled,
  explosive,
  isCanonicalRecipe,
  templatesBySlot,
  withFlatItems,
  type ProgramTemplate,
} from './recipe'
import type { HybridSlot } from './rotate'

export { SYS } from './exercises'
export {
  controlled,
  explosive,
  legacyRoleForBlock,
  tempoLabel,
  type ProgramBlock,
  type ProgramItem,
  type ProgramTempo,
  type ProgramTemplate,
} from './recipe'

export const HYBRID_PROGRAM_TAG = 'Program: Hybrid 4-day'
export const HYBRID_SOURCE_KEY = 'hybrid-4-day'
// Internal recipe revision. The user-facing program remains Hybrid 4-day; notes say V2.1.
export const HYBRID_SOURCE_VERSION = 5

const DAY_RULES =
  'Most work at RPE 7–8 with 2–3 reps in reserve. Never grind tendon work. Use double progression: add load only after every work set reaches the top of its range at RPE 8 or lower.'

const definitions: Omit<ProgramTemplate, 'items'>[] = [
  {
    slot: 'A',
    name: 'Hybrid A — Squat + Push/Pull + Carry',
    notes: `${HYBRID_PROGRAM_TAG} A · V2.1\n\nBack squat + push/pull + carry. ~70 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'Add 3–5 minutes of easy cyclical work if useful, then prepare the shoulders.',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 30, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Light band. Elbow pinned to the ribs. Warm-up, not fatigue work.' }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.barbellBackSquat, plannedSets: 4, reps: [5, 6], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0), notes: 'The only heavy squat of the week. Whole foot down; brace before the descent. Do not grind. Hack squat or leg press is the swap if the back is not ready.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 120,
        notes: 'Alternate bench and row. Rest only after both exercises are complete.',
        items: [
          { exerciseId: SYS.dumbbellBenchPress, plannedSets: 3, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0), notes: 'Keep elbows roughly 30–60° from the torso.' },
          { exerciseId: SYS.chestSupportedRow, plannedSets: 3, reps: [8, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1), notes: 'Pull the elbow toward the hip; lower under control.' },
        ],
      },
      {
        key: 'push_up', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.pushUp, plannedSets: 2, reps: [8, 15], rpe: [7, 8], restSeconds: 75, tempo: controlled(2, 0, 1, 0), notes: 'Quality work, not a warm-up. If 15 is easy, elevate the feet or add a plate.' }],
      },
      {
        key: 'unilateral', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Do both legs with the same load and log one shared set.' }],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 3, distanceM: [30, 40], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Tall posture, neutral shoulders, short stable steps. Log load and distance.' }],
      },
      {
        key: 'arms', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.hammerCurl, plannedSets: 2, reps: [10, 12], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1), notes: 'The only direct biceps work. No swing; squeeze at the top.' }],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.externalRotation, plannedSets: 2, reps: [12, 15], rpe: [6, 7], restSeconds: 60, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Cable or band; pain-free, slow return.' },
          { exerciseId: SYS.wristExtension, plannedSets: 2, reps: [12, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 1, 0), notes: 'Forearm supported; only the wrist moves.' },
          { exerciseId: SYS.isometricHammerCurl, plannedSets: 2, durationS: [20, 30], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(0, 0, 0, 0), notes: 'Elbow near 90°. Strong, controlled and pain-free; not a maximal hold.' },
        ],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Hybrid B — Hinge + Vertical + Dips',
    notes: `${HYBRID_PROGRAM_TAG} B · V2.1\n\nHinge + vertical push/pull + dips + intervals. ~70–75 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'Add 3–5 minutes easy bike and hinge preparation as needed.',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 30, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Light band. Elbow pinned.' }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.trapBarDeadlift, plannedSets: 4, reps: [4, 6], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 5, tempo: controlled(2, 0, 1, 0), notes: 'Brace, push the floor away and finish tall without leaning back.' }],
      },
      {
        key: 'vertical_push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        notes: 'Alternate landmine press and pulldown. Rest after both exercises.',
        items: [
          { exerciseId: SYS.landminePress, plannedSets: 3, reps: [8, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0), notes: 'Half-kneeling is the default; keep ribs down.' },
          { exerciseId: SYS.latPulldown, plannedSets: 3, reps: [8, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(3, 0, 2, 1), notes: 'Neutral grip. A clean neutral-grip pull-up is an allowed swap.' },
        ],
      },
      {
        key: 'hinge_assistance', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.romanianDeadlift, plannedSets: 2, reps: [8, 8], rpe: [7, 7], rir: [3, 3], restSeconds: 120, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0), notes: 'Hips back, soft knees, neutral spine; keep the load close.' }],
      },
      {
        key: 'dips', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.dip, plannedSets: 3, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 0), notes: 'Slight forward lean. Do not grind or chase shoulder pain. Add a small plate when 8 is easy; shorten the range or swap if the shoulder complains.' }],
      },
      {
        key: 'power', role: 'power', format: 'straight',
        items: [{ exerciseId: SYS.kettlebellSwing, plannedSets: 3, reps: [8, 8], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 2, tempo: explosive, notes: 'Explosive hip hinge. End the set when bell speed or crispness drops.' }],
      },
      {
        key: 'conditioning', role: 'conditioning', format: 'interval', roundsInitial: 6, roundsMax: 6, restAfterRoundS: 0,
        interval: { prepareS: 10, workS: 30, recoveryS: 60, rounds: 6, targetRpe: [8, 8] },
        notes: 'Rower, bike or SkiErg. Fast work is RPE 8, not an all-out sprint.',
        items: [{ exerciseId: SYS.rowingMachine, plannedSets: 1, durationS: [540, 540], rpe: [8, 8], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: 'Use the linked block timer: 6 × 30 s fast / 60 s easy.' }],
      },
      {
        key: 'tendon_rear_delt', role: 'tendon', format: 'straight',
        items: [{ exerciseId: SYS.facePull, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(3, 0, 2, 1), notes: 'Control the return and externally rotate at the finish.' }],
      },
      {
        key: 'tendon_forearm', role: 'tendon', format: 'straight',
        items: [{ exerciseId: SYS.wristPronationSupination, plannedSets: 2, reps: [12, 12], rpe: [5, 7], restSeconds: 45, sideMode: 'per_side', directions: 2, loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Use the same load for both arms. Log pronation and supination once per set; forearm supported.' }],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Hybrid C — Unilateral / Athletic',
    notes: `${HYBRID_PROGRAM_TAG} C · V2.1\n\nUnilateral hinge, TRX row, anti-rotation, carries and a short finisher. ~70 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: '3–5 minutes easy cyclical work, then one easy hinge and squat preparation round.',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 30, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Light band. Elbow pinned. Warm-up, not fatigue work.' }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.singleLegRdl, plannedSets: 3, reps: [8, 8], rpe: [7, 8], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0), notes: 'Balance, hinge and pelvis control come before load. Log both legs together. Back squat is on day A — do not add another squat here.' }],
      },
      {
        key: 'unilateral_push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        notes: 'Alternate TRX low row and cable press. Rest after both exercises.',
        items: [
          { exerciseId: SYS.invertedRow, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 75, tempo: controlled(3, 0, 1, 1), notes: 'TRX low row. More horizontal = harder. Pull the handles to the chest. Rings or a bar are allowed swaps.' },
          { exerciseId: SYS.halfKneelingCablePress, plannedSets: 3, reps: [8, 8], rpe: [7, 8], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0), notes: 'Squeeze the down-knee glute; do not rotate.' },
        ],
      },
      {
        key: 'carry_core', role: 'carry', format: 'straight',
        items: [
          { exerciseId: SYS.suitcaseCarry, plannedSets: 3, distanceM: [30, 40], rpe: [7, 8], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Do not lean; finish both sides before resting.' },
          { exerciseId: SYS.pallofPress, plannedSets: 3, reps: [10, 10], rpe: [6, 7], restSeconds: 60, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 2, 2), notes: 'Hold at full extension and resist rotation.' },
          { exerciseId: SYS.deadBug, plannedSets: 2, reps: [8, 8], rpe: [5, 7], restSeconds: 45, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0), notes: 'Low back stays down; shorten range if needed.' },
        ],
      },
      {
        key: 'finisher', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 3, restAfterRoundS: 60,
        notes: 'Three quality rounds. Stop if the last round no longer looks like the first.',
        items: [
          { exerciseId: SYS.kettlebellSwing, plannedSets: 1, reps: [12, 12], rpe: [7, 8], restSeconds: 0, tempo: explosive, notes: 'Explosive hinge; stop if speed falls.' },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [10, 10], rpe: [7, 8], restSeconds: 0, tempo: controlled(2, 0, 1, 0), notes: 'Easier than the day A sets; keep quality.' },
          { exerciseId: SYS.rowingMachine, plannedSets: 1, distanceM: [200, 200], rpe: [7, 8], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '200 m, then use the block-level 60 s round rest.' },
        ],
      },
    ],
  },
  {
    slot: 'D',
    name: 'Hybrid D — Longevity',
    notes: `${HYBRID_PROGRAM_TAG} D · V2.1\n\nIntentionally easier: functional circuit, Zone 2 and focused tendon work. Circuit RPE 6–7. Do not place this day immediately after C.`,
    blocks: [
      {
        key: 'circuit', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 3, restAfterRoundS: 75,
        notes: 'Three rounds. Keep RPE 6–7. No dips — shoulders rest.',
        items: [
          { exerciseId: SYS.gobletSquat, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.invertedRow, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(3, 0, 1, 1), notes: 'TRX low row or bar. Easy version of the day C work.' },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.kettlebellDeadlift, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(3, 0, 1, 0) },
          { exerciseId: SYS.farmerCarry, plannedSets: 1, distanceM: [30, 30], rpe: [6, 7], restSeconds: 0, tempo: controlled(1, 0, 1, 0), notes: '30 m. Rest only after the full round.' },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [1800, 2400], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '30–40 min. Talk test: you can still speak in sentences.' }],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.externalRotation, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Cable or band; elbow pinned.' },
          { exerciseId: SYS.scaptionRaise, plannedSets: 2, reps: [12, 12], rpe: [5, 7], restSeconds: 45, loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Very light; thumbs up; stop around shoulder height.' },
          { exerciseId: SYS.wristExtension, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 2, 0), notes: 'Forearm fully supported.' },
          { exerciseId: SYS.standingCalfRaise, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Heavier calf/Achilles work.' },
          { exerciseId: SYS.seatedCalfRaise, plannedSets: 2, reps: [12, 15], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Soleus/Achilles focus.' },
          { exerciseId: SYS.deadHang, plannedSets: 2, durationS: [20, 40], rpe: [4, 6], restSeconds: 60, tempo: controlled(0, 0, 0, 0), notes: 'Optional and only fully pain-free; keep light scapular tone if a passive hang is uncomfortable.' },
        ],
      },
    ],
  },
]

export const HYBRID_TEMPLATES: ProgramTemplate[] = withFlatItems(definitions)

const SLOT_RE = new RegExp(`^${HYBRID_PROGRAM_TAG} ([ABCD])\\b`)
const NAME_RE = /^Hybrid ([ABCD])\b/

export function hybridSlotFromNotes(notes: string | null | undefined): HybridSlot | null {
  if (!notes) return null
  return asDaySlot(notes.match(SLOT_RE)?.[1])
}

export function isHybridTaggedTemplate(
  template: Pick<TemplateRow, 'name' | 'notes'>,
): boolean {
  return hybridSlotFromNotes(template.notes) !== null || NAME_RE.test(template.name)
}

export function hybridSlotFromTemplate(
  template: Pick<TemplateRow, 'name' | 'notes'> & { source_slot?: string | null },
): HybridSlot | null {
  return hybridSlotFromNotes(template.notes)
    ?? asDaySlot(template.name.match(NAME_RE)?.[1])
    ?? (isHybridTaggedTemplate(template) ? asDaySlot(template.source_slot) : null)
}

export function hybridTemplatesFrom<T extends Pick<TemplateRow, 'id' | 'name' | 'notes'>>(
  templates: (T & { source_slot?: string | null })[],
): Record<HybridSlot, T & { source_slot?: string | null }> | null {
  const found: Partial<Record<HybridSlot, T & { source_slot?: string | null }>> = {}
  for (const template of templates) {
    const slot = hybridSlotFromTemplate(template)
    if (slot && !found[slot]) found[slot] = template
  }
  return found.A && found.B && found.C && found.D
    ? (found as Record<HybridSlot, T & { source_slot?: string | null }>)
    : null
}

export function hybridTemplatesOnPlan<T extends Pick<TemplateRow, 'id' | 'name' | 'notes' | 'plan_id'> & { source_slot?: string | null }>(
  templates: T[],
  planId: string,
): Record<HybridSlot, T> | null {
  const onPlan = templates.filter((row) => row.plan_id === planId)
  return templatesBySlot(onPlan, ['A', 'B', 'C', 'D']) ?? hybridTemplatesFrom(onPlan)
}

export function isHybridProgramInstalled(
  templates: Pick<TemplateRow, 'id' | 'name' | 'notes' | 'source_slot'>[],
): boolean {
  return hybridTemplatesFrom(templates) !== null
}

/** Legacy compatibility for old callers; V2 derives the role from its block. */
export function plannedBlockRole(item?: unknown): ExerciseBlockRole {
  if (typeof item === 'object' && item !== null && 'blockRole' in item) {
    const role = (item as { blockRole?: unknown }).blockRole
    if (role === 'cardio' || role === 'tendon') return role
  }
  return 'gym'
}

/** V2 replaces the complete recipe, so the former positional role patch is obsolete. */
export function hybridRolePatches(
  ..._legacy: unknown[]
): { id: string; block_role: ExerciseBlockRole }[] {
  return []
}

export function buildHybridV2Rows(input: {
  templates: Record<HybridSlot, Pick<TemplateRow, 'id'>>
  now: string
  newId: () => string
}): { blocks: TemplateBlockRow[]; items: TemplateItemRow[] } {
  return buildProgramRows({
    definitions: HYBRID_TEMPLATES,
    templates: input.templates,
    now: input.now,
    newId: input.newId,
  })
}

/** Full semantic check used by the automatic upgrader. IDs and timestamps are
 * intentionally ignored; every block/item prescription field is compared. */
export function isHybridV2CanonicalRecipe(input: {
  templates: Record<HybridSlot, Pick<TemplateRow, 'id' | 'name' | 'notes'> & { source_slot?: string | null }>
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
}): boolean {
  return isCanonicalRecipe({
    definitions: HYBRID_TEMPLATES,
    templates: input.templates,
    blocks: input.blocks,
    items: input.items,
  })
}

export function buildHybridV2Upgrade(input: {
  ownerId: string
  existingPlan: TrainingPlanRow | null
  installed: Record<HybridSlot, TemplateRow> | null
  now: string
  newId: () => string
  planName: string
  planNotes: string
}): {
  created: boolean
  plan: TrainingPlanRow
  templates: Record<HybridSlot, TemplateRow>
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
} {
  return buildProgramUpgrade({
    ownerId: input.ownerId,
    existingPlan: input.existingPlan,
    installed: input.installed,
    now: input.now,
    newId: input.newId,
    sourceKey: HYBRID_SOURCE_KEY,
    sourceVersion: HYBRID_SOURCE_VERSION,
    planName: input.planName,
    planNotes: input.planNotes,
    definitions: HYBRID_TEMPLATES,
  })
}

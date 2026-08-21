import type {
  ExerciseBlockRole,
  SideMode,
  TemplateBlockRow,
  TemplateItemRow,
  TemplateRow,
  TrainingPlanRow,
  TempoIntent,
  WorkoutBlockFormat,
  WorkoutBlockRole,
} from '../../types/db'
import type { HybridSlot } from './rotate'

export const HYBRID_PROGRAM_TAG = 'Program: Hybrid 4-day'
export const HYBRID_SOURCE_KEY = 'hybrid-4-day'
export const HYBRID_SOURCE_VERSION = 2

export const SYS = {
  romanianDeadlift: '11111111-1111-4111-8111-111111111107',
  stationaryBike: '11111111-1111-4111-8111-111111111110',
  rowingMachine: '11111111-1111-4111-8111-111111111111',
  trapBarDeadlift: '11111111-1111-4111-8111-111111111120',
  walkingLunge: '11111111-1111-4111-8111-111111111135',
  bulgarianSplitSquat: '11111111-1111-4111-8111-111111111136',
  landminePress: '11111111-1111-4111-8111-111111111137',
  standingCalfRaise: '11111111-1111-4111-8111-111111111138',
  dumbbellBenchPress: '11111111-1111-4111-8111-111111111139',
  oneArmDumbbellRow: '11111111-1111-4111-8111-111111111143',
  gobletSquat: '11111111-1111-4111-8111-111111111145',
  farmerCarry: '11111111-1111-4111-8111-111111111154',
  kettlebellSwing: '11111111-1111-4111-8111-111111111155',
  seatedCalfRaise: '11111111-1111-4111-8111-111111111162',
  latPulldown: '11111111-1111-4111-8111-111111111165',
  facePull: '11111111-1111-4111-8111-111111111167',
  tricepsPushdown: '11111111-1111-4111-8111-111111111169',
  pushUp: '11111111-1111-4111-8111-111111111177',
  invertedRow: '11111111-1111-4111-8111-111111111180',
  deadHang: '11111111-1111-4111-8111-111111111210',
  bodyweightSquat: '11111111-1111-4111-8111-111111111215',
  externalRotation: '11111111-1111-4111-8111-111111111217',
  chestSupportedRow: '11111111-1111-4111-8111-111111111218',
  wristExtension: '11111111-1111-4111-8111-111111111219',
  isometricHammerCurl: '11111111-1111-4111-8111-111111111220',
  kettlebellDeadlift: '11111111-1111-4111-8111-111111111223',
  singleLegRdl: '11111111-1111-4111-8111-111111111224',
  halfKneelingCablePress: '11111111-1111-4111-8111-111111111225',
  stepUp: '11111111-1111-4111-8111-111111111226',
  suitcaseCarry: '11111111-1111-4111-8111-111111111227',
  pallofPress: '11111111-1111-4111-8111-111111111228',
  deadBug: '11111111-1111-4111-8111-111111111229',
  scaptionRaise: '11111111-1111-4111-8111-111111111230',
  wristPronationSupination: '11111111-1111-4111-8111-111111111231',
} as const

export interface ProgramTempo {
  eccentric: number
  stretchPause: number
  concentric: number
  contractedPause: number
  intent: TempoIntent
}

export interface ProgramItem {
  exerciseId: string
  plannedSets: number
  reps?: [number, number]
  durationS?: [number, number]
  distanceM?: [number, number]
  targetWeightKg?: number | null
  rpe?: [number, number]
  rir?: [number, number]
  restSeconds?: number | null
  sideMode?: SideMode
  directions?: number
  loadIncrementKg?: number | null
  tempo: ProgramTempo
  notes?: string | null
}

export interface ProgramBlock {
  key: string
  role: WorkoutBlockRole
  format: WorkoutBlockFormat
  roundsInitial?: number
  roundsMax?: number
  restAfterRoundS?: number | null
  notes?: string | null
  interval?: {
    prepareS: number
    workS: number
    recoveryS: number
    rounds: number
    targetRpe: [number, number]
  }
  items: ProgramItem[]
}

export interface ProgramTemplate {
  slot: HybridSlot
  name: string
  notes: string
  blocks: ProgramBlock[]
  /** Flat compatibility view; block relationships live in `blocks`. */
  items: ProgramItem[]
}

const controlled = (
  eccentric = 2,
  stretchPause = 0,
  concentric = 1,
  contractedPause = 0,
): ProgramTempo => ({ eccentric, stretchPause, concentric, contractedPause, intent: 'controlled' })

const explosive: ProgramTempo = {
  eccentric: 1,
  stretchPause: 0,
  concentric: 0,
  contractedPause: 0,
  intent: 'explosive',
}

const DAY_RULES =
  'Most work at RPE 7–8 with 2–3 reps in reserve. Never grind tendon work. Use double progression: add load only after every work set reaches the top of its range at RPE 8 or lower.'

const definitions: Omit<ProgramTemplate, 'items'>[] = [
  {
    slot: 'A',
    name: 'Hybrid A — Squat + Push/Pull + Carry',
    notes: `${HYBRID_PROGRAM_TAG} A · V2\n\nSquat + push/pull + carry. ~65–75 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'Add 3–5 minutes of easy cyclical work if useful, then prepare the shoulders.',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 30, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Light band. Elbow pinned to the ribs. Warm-up, not fatigue work.' }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [
          { exerciseId: SYS.gobletSquat, plannedSets: 4, reps: [6, 6], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Whole foot down; knees track the feet. Front squat is an allowed long-term swap.' },
          { exerciseId: SYS.dumbbellBenchPress, plannedSets: 3, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0), notes: 'Keep elbows roughly 30–60° from the torso.' },
          { exerciseId: SYS.chestSupportedRow, plannedSets: 3, reps: [8, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1), notes: 'Pull the elbow toward the hip; lower under control.' },
          { exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [8, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Complete both legs before starting the rest timer.' },
        ],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 4, distanceM: [30, 40], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Tall posture, neutral shoulders, short stable steps. Log load and distance.' }],
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
    name: 'Hybrid B — Hinge + Vertical Push/Pull',
    notes: `${HYBRID_PROGRAM_TAG} B · V2\n\nHinge + vertical push/pull + intervals. ~65–75 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'Add 3–5 minutes easy bike and hinge preparation as needed.',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 30, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Light band. Elbow pinned.' }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [
          { exerciseId: SYS.trapBarDeadlift, plannedSets: 4, reps: [4, 6], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 5, tempo: controlled(2, 0, 1, 0), notes: 'Brace, push the floor away and finish tall without leaning back.' },
          { exerciseId: SYS.landminePress, plannedSets: 3, reps: [8, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0), notes: 'Half-kneeling is the default; keep ribs down.' },
          { exerciseId: SYS.latPulldown, plannedSets: 3, reps: [8, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(3, 0, 2, 1), notes: 'Neutral grip. A clean neutral-grip pull-up is an allowed swap.' },
          { exerciseId: SYS.romanianDeadlift, plannedSets: 2, reps: [8, 8], rpe: [7, 7], rir: [3, 3], restSeconds: 120, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0), notes: 'Hips back, soft knees, neutral spine; keep the load close.' },
        ],
      },
      {
        key: 'power', role: 'power', format: 'straight',
        items: [{ exerciseId: SYS.kettlebellSwing, plannedSets: 4, reps: [8, 8], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 2, tempo: explosive, notes: 'Explosive hip hinge. End the set when bell speed or crispness drops.' }],
      },
      {
        key: 'conditioning', role: 'conditioning', format: 'interval', roundsInitial: 6, roundsMax: 6, restAfterRoundS: 0,
        interval: { prepareS: 10, workS: 30, recoveryS: 60, rounds: 6, targetRpe: [8, 8] },
        notes: 'Rower, bike or SkiErg. Fast work is RPE 8, not an all-out sprint.',
        items: [{ exerciseId: SYS.rowingMachine, plannedSets: 1, durationS: [540, 540], rpe: [8, 8], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: 'Use the linked block timer: 6 × 30 s fast / 60 s easy.' }],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.facePull, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(3, 0, 2, 1), notes: 'Control the return and externally rotate at the finish.' },
          { exerciseId: SYS.tricepsPushdown, plannedSets: 2, reps: [12, 12], rpe: [6, 7], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(4, 0, 2, 0), notes: 'Slow return; no shoulder movement.' },
          { exerciseId: SYS.wristPronationSupination, plannedSets: 2, reps: [12, 12], rpe: [5, 7], restSeconds: 45, sideMode: 'per_side', directions: 2, loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Both arms × pronation and supination. Forearm supported; use a very light load.' },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Hybrid C — Unilateral / Athletic',
    notes: `${HYBRID_PROGRAM_TAG} C · V2\n\nUnilateral strength, anti-rotation, carries and a quality finisher.\n${DAY_RULES}`,
    blocks: [
      { key: 'warmup', role: 'warmup', format: 'straight', notes: 'Short warm-up: 3–5 minutes easy cyclical work, then one easy preparation round for squat, hinge and shoulders.', items: [] },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [
          { exerciseId: SYS.gobletSquat, plannedSets: 3, reps: [8, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Goblet or front squat; keep the chosen variation for 8–12 weeks.' },
          { exerciseId: SYS.singleLegRdl, plannedSets: 3, reps: [8, 8], rpe: [7, 8], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0), notes: 'Balance, hinge and pelvis control come before load.' },
          { exerciseId: SYS.oneArmDumbbellRow, plannedSets: 3, reps: [8, 8], rpe: [7, 8], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(3, 0, 1, 1), notes: 'Keep the torso square.' },
          { exerciseId: SYS.halfKneelingCablePress, plannedSets: 3, reps: [8, 8], rpe: [7, 8], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0), notes: 'Squeeze the down-knee glute; do not rotate.' },
          { exerciseId: SYS.stepUp, plannedSets: 3, reps: [8, 8], rpe: [7, 8], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0), notes: 'Front leg does the work; avoid pushing off the floor leg.' },
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
        key: 'finisher', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 4, restAfterRoundS: 60,
        notes: 'Quality over wreckage. Progress from three to four rounds only when the last round looks like the first.',
        items: [
          { exerciseId: SYS.kettlebellSwing, plannedSets: 1, reps: [12, 12], rpe: [7, 8], restSeconds: 0, tempo: explosive, notes: 'Explosive hinge; stop if speed falls.' },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [10, 10], rpe: [7, 8], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.walkingLunge, plannedSets: 1, reps: [10, 10], rpe: [7, 8], restSeconds: 0, tempo: controlled(2, 0, 1, 0), notes: '10 total steps, not per leg.' },
          { exerciseId: SYS.rowingMachine, plannedSets: 1, distanceM: [200, 200], rpe: [7, 8], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '200 m, then use the block-level 60 s round rest.' },
        ],
      },
    ],
  },
  {
    slot: 'D',
    name: 'Hybrid D — Longevity',
    notes: `${HYBRID_PROGRAM_TAG} D · V2\n\nIntentionally easier: functional circuit, Zone 2 and focused tendon work. Circuit RPE 6–7.`,
    blocks: [
      {
        key: 'circuit', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 4, restAfterRoundS: 75,
        notes: 'Start with three rounds. Add a fourth only when quality and recovery stay good.',
        items: [
          { exerciseId: SYS.gobletSquat, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.invertedRow, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(3, 0, 1, 1), notes: 'TRX or bar.' },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.kettlebellDeadlift, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(3, 0, 1, 0) },
          { exerciseId: SYS.farmerCarry, plannedSets: 1, distanceM: [30, 30], rpe: [6, 7], restSeconds: 0, tempo: controlled(1, 0, 1, 0), notes: '30 m. Rest only after the full round.' },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [1500, 1800], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '25–30 min. Talk test: you can still speak in sentences.' }],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.externalRotation, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Cable or band; elbow pinned.' },
          { exerciseId: SYS.scaptionRaise, plannedSets: 2, reps: [12, 12], rpe: [5, 7], restSeconds: 45, loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Very light; thumbs up; stop around shoulder height.' },
          { exerciseId: SYS.wristExtension, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 2, 0), notes: 'Forearm fully supported.' },
          { exerciseId: SYS.standingCalfRaise, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Heavier calf/Achilles work.' },
          { exerciseId: SYS.seatedCalfRaise, plannedSets: 3, reps: [12, 15], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Soleus/Achilles focus.' },
          { exerciseId: SYS.deadHang, plannedSets: 2, durationS: [20, 40], rpe: [4, 6], restSeconds: 60, tempo: controlled(0, 0, 0, 0), notes: 'Optional and only fully pain-free; keep light scapular tone if a passive hang is uncomfortable.' },
        ],
      },
    ],
  },
]

export const HYBRID_TEMPLATES: ProgramTemplate[] = definitions.map((template) => ({
  ...template,
  items: template.blocks.flatMap((block) => block.items),
}))

const SLOT_RE = new RegExp(`^${HYBRID_PROGRAM_TAG} ([ABCD])\\b`)
const NAME_RE = /^Hybrid ([ABCD])\b/

function asSlot(value: string | undefined | null): HybridSlot | null {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' ? value : null
}

export function hybridSlotFromNotes(notes: string | null | undefined): HybridSlot | null {
  if (!notes) return null
  return asSlot(notes.match(SLOT_RE)?.[1])
}

export function hybridSlotFromTemplate(
  template: Pick<TemplateRow, 'name' | 'notes'> & { source_slot?: string | null },
): HybridSlot | null {
  return asSlot(template.source_slot) ?? hybridSlotFromNotes(template.notes) ?? asSlot(template.name.match(NAME_RE)?.[1])
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

export function isHybridProgramInstalled(
  templates: Pick<TemplateRow, 'id' | 'name' | 'notes' | 'source_slot'>[],
): boolean {
  return hybridTemplatesFrom(templates) !== null
}

export function legacyRoleForBlock(role: WorkoutBlockRole): ExerciseBlockRole {
  if (role === 'tendon') return 'tendon'
  if (role === 'conditioning' || role === 'zone_2') return 'cardio'
  return 'gym'
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

export function tempoLabel(tempo: ProgramTempo): string {
  const concentric = tempo.intent === 'explosive' ? 'X' : String(tempo.concentric)
  return `${tempo.eccentric}-${tempo.stretchPause}-${concentric}-${tempo.contractedPause}`
}

export function buildHybridV2Rows(input: {
  templates: Record<HybridSlot, Pick<TemplateRow, 'id'>>
  now: string
  newId: () => string
}): { blocks: TemplateBlockRow[]; items: TemplateItemRow[] } {
  const blocks: TemplateBlockRow[] = []
  const items: TemplateItemRow[] = []
  for (const definition of HYBRID_TEMPLATES) {
    const templateId = input.templates[definition.slot].id
    let globalPosition = 0
    definition.blocks.forEach((definitionBlock, blockIndex) => {
      const blockId = input.newId()
      const interval = definitionBlock.interval
      blocks.push({
        id: blockId, template_id: templateId, position: blockIndex,
        role: definitionBlock.role, format: definitionBlock.format,
        rounds_initial: definitionBlock.roundsInitial ?? 1,
        rounds_max: definitionBlock.roundsMax ?? definitionBlock.roundsInitial ?? 1,
        rest_after_round_s: definitionBlock.restAfterRoundS ?? null,
        notes: definitionBlock.notes ?? null,
        interval_prepare_s: interval?.prepareS ?? null,
        interval_work_s: interval?.workS ?? null,
        interval_recovery_s: interval?.recoveryS ?? null,
        interval_rounds: interval?.rounds ?? null,
        target_rpe_min: interval?.targetRpe[0] ?? null,
        target_rpe_max: interval?.targetRpe[1] ?? null,
        created_at: input.now, updated_at: input.now,
      })
      definitionBlock.items.forEach((item, blockPosition) => {
        const reps = item.reps ?? null
        const duration = item.durationS ?? null
        const distance = item.distanceM ?? null
        const rpe = item.rpe ?? null
        const rir = item.rir ?? null
        items.push({
          id: input.newId(), template_id: templateId, exercise_id: item.exerciseId,
          position: globalPosition++, planned_sets: item.plannedSets,
          target_weight_kg: item.targetWeightKg ?? null,
          target_reps: reps?.[1] ?? null,
          target_duration_s: duration?.[1] ?? null,
          target_distance_m: distance?.[1] ?? null,
          rest_seconds: item.restSeconds ?? null,
          tempo: tempoLabel(item.tempo), notes: item.notes ?? null,
          superset_group: null, block_role: legacyRoleForBlock(definitionBlock.role),
          block_id: blockId, block_position: blockPosition,
          target_reps_min: reps?.[0] ?? null, target_reps_max: reps?.[1] ?? null,
          target_duration_min_s: duration?.[0] ?? null, target_duration_max_s: duration?.[1] ?? null,
          target_distance_min_m: distance?.[0] ?? null, target_distance_max_m: distance?.[1] ?? null,
          target_rpe_min: rpe?.[0] ?? null, target_rpe_max: rpe?.[1] ?? null,
          target_rir_min: rir?.[0] ?? null, target_rir_max: rir?.[1] ?? null,
          side_mode: item.sideMode ?? 'bilateral', directions: item.directions ?? 1,
          load_increment_kg: item.loadIncrementKg ?? null,
          tempo_eccentric: item.tempo.eccentric,
          tempo_stretch_pause: item.tempo.stretchPause,
          tempo_concentric: item.tempo.concentric,
          tempo_contracted_pause: item.tempo.contractedPause,
          tempo_intent: item.tempo.intent,
          created_at: input.now, updated_at: input.now,
        })
      })
    })
  }
  return { blocks, items }
}

const BLOCK_RECIPE_FIELDS = [
  'position',
  'role',
  'format',
  'rounds_initial',
  'rounds_max',
  'rest_after_round_s',
  'notes',
  'interval_prepare_s',
  'interval_work_s',
  'interval_recovery_s',
  'interval_rounds',
  'target_rpe_min',
  'target_rpe_max',
] as const satisfies readonly (keyof TemplateBlockRow)[]

const ITEM_RECIPE_FIELDS = [
  'exercise_id',
  'position',
  'planned_sets',
  'target_weight_kg',
  'target_reps',
  'target_duration_s',
  'target_distance_m',
  'rest_seconds',
  'tempo',
  'notes',
  'superset_group',
  'block_role',
  'block_position',
  'target_reps_min',
  'target_reps_max',
  'target_duration_min_s',
  'target_duration_max_s',
  'target_distance_min_m',
  'target_distance_max_m',
  'target_rpe_min',
  'target_rpe_max',
  'target_rir_min',
  'target_rir_max',
  'side_mode',
  'directions',
  'load_increment_kg',
  'tempo_eccentric',
  'tempo_stretch_pause',
  'tempo_concentric',
  'tempo_contracted_pause',
  'tempo_intent',
] as const satisfies readonly (keyof TemplateItemRow)[]

function sameFields<T extends object>(
  actual: T,
  expected: T,
  fields: readonly (keyof T)[],
): boolean {
  return fields.every((field) => (actual[field] ?? null) === (expected[field] ?? null))
}

/** Full semantic check used by the automatic upgrader. IDs and timestamps are
 * intentionally ignored; every block/item prescription field is compared. */
export function isHybridV2CanonicalRecipe(input: {
  templates: Record<HybridSlot, Pick<TemplateRow, 'id' | 'name' | 'notes'> & { source_slot?: string | null }>
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
}): boolean {
  let sequence = 0
  const expected = buildHybridV2Rows({
    templates: input.templates,
    now: '2000-01-01T00:00:00.000Z',
    newId: () => `expected-${++sequence}`,
  })
  for (const definition of HYBRID_TEMPLATES) {
    const template = input.templates[definition.slot]
    if (template.source_slot !== definition.slot || template.name !== definition.name) return false
    const actualBlocks = input.blocks
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    const expectedBlocks = expected.blocks
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    if (actualBlocks.length !== expectedBlocks.length) return false
    if (!actualBlocks.every((row, index) => sameFields(row, expectedBlocks[index]!, BLOCK_RECIPE_FIELDS))) return false

    const actualBlockPosition = new Map(actualBlocks.map((row) => [row.id, row.position]))
    const expectedBlockPosition = new Map(expectedBlocks.map((row) => [row.id, row.position]))
    const actualItems = input.items
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    const expectedItems = expected.items
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    if (actualItems.length !== expectedItems.length) return false
    if (!actualItems.every((row, index) => {
      const expectedRow = expectedItems[index]!
      return sameFields(row, expectedRow, ITEM_RECIPE_FIELDS) &&
        actualBlockPosition.get(row.block_id ?? '') === expectedBlockPosition.get(expectedRow.block_id ?? '')
    })) return false
  }
  return true
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
  const plan: TrainingPlanRow = input.existingPlan
    ? {
        ...input.existingPlan,
        name: input.planName,
        notes: input.planNotes,
        source_key: HYBRID_SOURCE_KEY,
        source_version: HYBRID_SOURCE_VERSION,
        updated_at: input.now,
      }
    : {
        id: input.newId(), owner_id: input.ownerId, name: input.planName, notes: input.planNotes,
        source_key: HYBRID_SOURCE_KEY, source_version: HYBRID_SOURCE_VERSION,
        created_at: input.now, updated_at: input.now,
      }
  const templates = {} as Record<HybridSlot, TemplateRow>
  HYBRID_TEMPLATES.forEach((definition, index) => {
    const previous = input.installed?.[definition.slot]
    templates[definition.slot] = {
      id: previous?.id ?? input.newId(), owner_id: input.ownerId,
      name: definition.name, notes: definition.notes,
      plan_id: plan.id, plan_position: index, source_slot: definition.slot,
      created_at: previous?.created_at ?? input.now, updated_at: input.now,
    }
  })
  return {
    created: !input.installed,
    plan,
    templates,
    ...buildHybridV2Rows({ templates, now: input.now, newId: input.newId }),
  }
}

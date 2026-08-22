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
// Internal recipe revision. The user-facing program remains Hybrid 4-day; notes say V3.
export const HYBRID_SOURCE_VERSION = 6

const DAY_RULES =
  'Most work at RPE 7–8 with 2–3 reps in reserve. Never grind tendon work. Use double progression: add load only after every work set reaches the top of its range at RPE 8 or lower.'

const definitions: Omit<ProgramTemplate, 'items'>[] = [
  {
    slot: 'A',
    name: 'Hybrid A — Squat + Push/Pull + Carry',
    notes: `${HYBRID_PROGRAM_TAG} A · V3\n\nSquat + horizontal push/pull + carry. ~70 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'Complete the easy cyclical work first, then the movement preparation. No external rotation in this warm-up.',
        items: [
          { exerciseId: SYS.rowingMachine, plannedSets: 1, durationS: [180, 240], rpe: [3, 4], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: 'Easy rower or bike for 3–4 min.' },
          { exerciseId: SYS.bodyweightSquat, plannedSets: 2, reps: [10, 10], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.walkingLunge, plannedSets: 2, reps: [6, 6], rpe: [4, 5], restSeconds: 0, sideMode: 'per_side', tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.bandPullApart, plannedSets: 2, reps: [15, 15], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.scapularPushUp, plannedSets: 2, reps: [10, 10], rpe: [4, 5], restSeconds: 30, tempo: controlled(2, 0, 2, 0), notes: 'Arms stay straight.' },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.gobletSquat, plannedSets: 4, reps: [6, 6], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Goblet Squat. When a heavy DB/KB is no longer challenging for 4×6, progress to Front Squat. Whole foot down; brace before the descent.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        notes: 'DB Bench → 30–45 s → Machine Row → 75–90 s → repeat.',
        items: [
          { exerciseId: SYS.dumbbellBenchPress, plannedSets: 3, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 45, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0), notes: 'Keep elbows roughly 30–60° from the torso.' },
          { exerciseId: SYS.machineRow, plannedSets: 3, reps: [8, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1), notes: 'Pull elbows toward the hips; lower under control.' },
        ],
      },
      {
        key: 'unilateral', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [8, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Do both legs with the same load and log one shared set.' }],
      },
      {
        key: 'lateral_raise', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.cableLateralRaise, plannedSets: 3, reps: [12, 15], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1), notes: 'Controlled; stop near shoulder height.' }],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 3, distanceM: [30, 40], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Tall posture, neutral shoulders, short stable steps. Log load and distance.' }],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.externalRotation, plannedSets: 2, reps: [12, 15], rpe: [6, 7], restSeconds: 60, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Cable or band; pain-free, slow return.' },
          { exerciseId: SYS.wristExtension, plannedSets: 2, reps: [12, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 1, 0), notes: 'Forearm supported; only the wrist moves.' },
          { exerciseId: SYS.isometricHammerCurl, plannedSets: 3, durationS: [20, 30], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(0, 0, 0, 0), notes: 'Elbow near 90°. Strong, controlled and pain-free; not a maximal hold.' },
        ],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Hybrid B — Hinge + Vertical Push/Pull',
    notes: `${HYBRID_PROGRAM_TAG} B · V3\n\nHinge + vertical push/pull + dips + intervals. ~70–75 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'No external rotation in this warm-up. Prepare the hinge, then start the trap bar work fresh.',
        items: [
          { exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [180, 240], rpe: [3, 4], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: 'Easy bike for 3–4 min.' },
          { exerciseId: SYS.gluteBridge, plannedSets: 2, reps: [12, 12], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 1, 1, 1) },
          { exerciseId: SYS.hipHinge, plannedSets: 2, reps: [10, 10], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.kettlebellDeadlift, plannedSets: 2, reps: [10, 10], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.bandPullApart, plannedSets: 2, reps: [15, 15], rpe: [4, 5], restSeconds: 30, tempo: controlled(2, 0, 1, 0) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.trapBarDeadlift, plannedSets: 4, reps: [5, 5], rpe: [7, 8], rir: [2, 3], restSeconds: 180, loadIncrementKg: 5, tempo: controlled(2, 0, 1, 0), notes: 'Rest 2.5–3 min. Brace, push the floor away and finish tall without leaning back.' }],
      },
      {
        key: 'vertical_push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 120,
        notes: 'Strict Press → 45–60 s → Pull-Up → 90–120 s → repeat. This is an alternating strength pair, not a conditioning superset.',
        items: [
          { exerciseId: SYS.strictPress, plannedSets: 3, reps: [5, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(2, 0, 1, 0), notes: 'No leg drive; keep ribs down.' },
          { exerciseId: SYS.pullUp, plannedSets: 3, reps: [5, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 0), notes: 'Assisted → bodyweight → weighted. Add load only after 8/8/8 clean bodyweight reps.' },
        ],
      },
      {
        key: 'hinge_assistance', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.romanianDeadlift, plannedSets: 3, reps: [8, 8], rpe: [7, 7], rir: [3, 3], restSeconds: 120, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0), notes: 'Hips back, soft knees, neutral spine; keep the load moderate after trap-bar work.' }],
      },
      {
        key: 'dips', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.dip, plannedSets: 3, reps: [6, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 0), notes: 'Parallel bars only. Use 2–3 sets and stop at a comfortable, stable shoulder depth.' }],
      },
      {
        key: 'power', role: 'power', format: 'straight',
        items: [{ exerciseId: SYS.kettlebellSwing, plannedSets: 5, reps: [10, 10], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 2, tempo: explosive, notes: 'Explosive hip hinge. End the set when bell speed or crispness drops.' }],
      },
      {
        key: 'conditioning', role: 'conditioning', format: 'interval', roundsInitial: 6, roundsMax: 6, restAfterRoundS: 0,
        interval: { prepareS: 10, workS: 30, recoveryS: 60, rounds: 6, targetRpe: [8, 8] },
        notes: 'Rower, bike or SkiErg. Fast work is RPE 8, not an all-out sprint.',
        items: [{ exerciseId: SYS.rowingMachine, plannedSets: 1, durationS: [540, 540], rpe: [8, 8], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: 'Use the linked block timer: 6 × 30 s hard / 60 s easy. Rower, AirBike, or SkiErg.' }],
      },
      {
        key: 'tendon_rear_delt', role: 'tendon', format: 'straight',
        items: [{ exerciseId: SYS.facePull, plannedSets: 2, reps: [15, 15], rpe: [6, 7], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(3, 0, 2, 1), notes: 'Control the return and externally rotate at the finish.' }],
      },
      {
        key: 'tendon_forearm', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.wristPronationSupination, plannedSets: 2, reps: [12, 12], rpe: [5, 7], restSeconds: 45, sideMode: 'per_side', directions: 2, loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: '12 + 12 per arm. Forearm supported.' },
          { exerciseId: SYS.deadHang, plannedSets: 2, durationS: [20, 40], rpe: [4, 6], restSeconds: 60, tempo: controlled(0, 0, 0, 0), notes: 'Only if fully comfortable; use a light scapular set if passive hanging is not comfortable.' },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Hybrid C — Unilateral / Athletic',
    notes: `${HYBRID_PROGRAM_TAG} C · V3\n\nUnilateral + athletic power, horizontal strength, carries and conditioning. ~70 min.\n${DAY_RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'Complete the easy cyclical work and movement preparation before the power block.',
        items: [
          { exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [180, 240], rpe: [3, 4], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: 'Easy bike or rower for 3–4 min.' },
          { exerciseId: SYS.bodyweightSquat, plannedSets: 2, reps: [10, 10], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.walkingLunge, plannedSets: 2, reps: [6, 6], rpe: [4, 5], restSeconds: 0, sideMode: 'per_side', tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.bandPullApart, plannedSets: 2, reps: [15, 15], rpe: [4, 5], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.scapularPushUp, plannedSets: 2, reps: [10, 10], rpe: [4, 5], restSeconds: 30, tempo: controlled(2, 0, 2, 0), notes: 'Arms stay straight.' },
        ],
      },
      {
        key: 'power', role: 'power', format: 'straight',
        items: [{ exerciseId: SYS.boxJump, plannedSets: 3, reps: [4, 5], rpe: [6, 7], restSeconds: 90, tempo: explosive, notes: 'Do this immediately after warm-up. Rest 60–90 s; step down. Stop if jump height, landing, or confidence drops.' }],
      },
      {
        key: 'squat', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.gobletSquat, plannedSets: 3, reps: [8, 8], rpe: [7, 7], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Goblet or Front Squat.' }],
      },
      {
        key: 'unilateral_hinge', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.singleLegRdl, plannedSets: 3, reps: [8, 8], rpe: [7, 7], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0), notes: 'Balance, hinge, and pelvis control come before load. Log both legs together.' }],
      },
      {
        key: 'horizontal_push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        notes: 'Incline DB Bench → 30–45 s → TRX/Inverted Row → 75–90 s → repeat.',
        items: [
          { exerciseId: SYS.inclineDbBench, plannedSets: 3, reps: [8, 10], rpe: [7, 7], restSeconds: 45, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0), notes: 'Moderate incline; keep the elbows controlled.' },
          { exerciseId: SYS.invertedRow, plannedSets: 3, reps: [8, 12], rpe: [7, 7], restSeconds: 90, tempo: controlled(3, 0, 1, 1), notes: 'TRX or inverted row. More horizontal = harder.' },
        ],
      },
      {
        key: 'step_up', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.stepUp, plannedSets: 3, reps: [8, 8], rpe: [7, 7], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0), notes: 'Drive through the front foot and control the lowering.' }],
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
        key: 'external_rotation', role: 'tendon', format: 'straight',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 2, reps: [12, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Slow and controlled; elbow pinned to ribs.' }],
      },
      {
        key: 'finisher', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 3, restAfterRoundS: 60,
        notes: 'Three quality rounds. Rest 60–90 s between rounds; no rowing in this finisher.',
        items: [
          { exerciseId: SYS.kettlebellSwing, plannedSets: 1, reps: [12, 12], rpe: [7, 8], restSeconds: 0, tempo: explosive, notes: 'Explosive hinge; stop if speed falls.' },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [10, 10], rpe: [7, 8], restSeconds: 0, tempo: controlled(2, 0, 1, 0), notes: 'Easier than the day A sets; keep quality.' },
          { exerciseId: SYS.burpeeStepOver, plannedSets: 1, reps: [6, 8], rpe: [7, 8], restSeconds: 0, tempo: controlled(2, 0, 1, 0), notes: 'Controlled burpee, then step over a low stable box. This is not a box-jump drill.' },
        ],
      },
    ],
  },
  {
    slot: 'D',
    name: 'Hybrid D — Longevity',
    notes: `${HYBRID_PROGRAM_TAG} D · V3\n\nIntentionally easier: functional circuit, accessories, lower-leg work and Zone 2. Circuit RPE 6–7. Do not place this day immediately after C.`,
    blocks: [
      {
        key: 'circuit', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 4, restAfterRoundS: 75,
        notes: 'Three to four light rounds. Keep RPE 6–7; this is not a CrossFit workout.',
        items: [
          { exerciseId: SYS.gobletSquat, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [10, 10], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
        ],
      },
      {
        key: 'leg_curl', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.seatedLegCurl, plannedSets: 3, reps: [10, 12], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 1), notes: 'Controlled eccentric.' }],
      },
      {
        key: 'rear_delt', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.reverseFlyMachine, plannedSets: 3, reps: [12, 15], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(3, 0, 1, 1), notes: 'Light-to-moderate load. Move from the rear delts and shoulder blades, not momentum.' }],
      },
      {
        key: 'scaption', role: 'tendon', format: 'straight',
        items: [{ exerciseId: SYS.scaptionRaise, plannedSets: 3, reps: [12, 15], rpe: [5, 7], restSeconds: 45, loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0), notes: 'Very light; thumbs up; stop around shoulder height.' }],
      },
      {
        key: 'triceps', role: 'tendon', format: 'straight',
        items: [{ exerciseId: SYS.singleArmCableTricepsExtension, plannedSets: 3, reps: [12, 15], rpe: [7, 7], restSeconds: 60, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(3, 0, 1, 0), notes: 'Tempo: 1–2 s extension / 3 s controlled return.' }],
      },
      {
        key: 'arm_tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.hammerCurl, plannedSets: 2, reps: [10, 12], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(4, 0, 2, 0), notes: 'Slow hammer curl: 2 s up / 3–4 s down. No swinging.' },
          { exerciseId: SYS.wristExtension, plannedSets: 3, reps: [12, 15], rpe: [6, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 1, 0), notes: 'Use 2–3 sets. Forearm fully supported; 3–4 s eccentric.' },
          { exerciseId: SYS.deadHang, plannedSets: 2, durationS: [20, 40], rpe: [4, 6], restSeconds: 60, tempo: controlled(0, 0, 0, 0), notes: 'Only if fully comfortable; keep light scapular tone if a passive hang is uncomfortable.' },
        ],
      },
      {
        key: 'lower_leg', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.standingCalfRaise, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Tempo: 2 s up → 1–2 s hold → 3 s down.' },
          { exerciseId: SYS.seatedCalfRaise, plannedSets: 3, reps: [12, 15], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Seated Soleus Raise. Tempo: 2–1–3.' },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [1500, 1800], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '25–30 min. Bike, incline treadmill, or rower. Talk test: you can still speak in sentences.' }],
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

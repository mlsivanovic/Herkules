// Hybrid 4-day starter. Copied into the signed-in user's own routines on
// install — notes are English defaults, visible to every account that adds
// the program, and fully editable afterwards (not locked system text).

import type { TemplateRow } from '../../types/db'
import type { HybridSlot } from './rotate'

export const HYBRID_PROGRAM_TAG = 'Program: Hybrid 4-day'

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
  hammerCurl: '11111111-1111-4111-8111-111111111150',
  farmerCarry: '11111111-1111-4111-8111-111111111154',
  kettlebellSwing: '11111111-1111-4111-8111-111111111155',
  seatedCalfRaise: '11111111-1111-4111-8111-111111111162',
  latPulldown: '11111111-1111-4111-8111-111111111165',
  facePull: '11111111-1111-4111-8111-111111111167',
  tricepsPushdown: '11111111-1111-4111-8111-111111111169',
  pushUp: '11111111-1111-4111-8111-111111111177',
  invertedRow: '11111111-1111-4111-8111-111111111180',
  bandPullApart: '11111111-1111-4111-8111-111111111206',
  deadHang: '11111111-1111-4111-8111-111111111210',
  bodyweightSquat: '11111111-1111-4111-8111-111111111215',
  scapularPushUp: '11111111-1111-4111-8111-111111111216',
  externalRotation: '11111111-1111-4111-8111-111111111217',
  chestSupportedRow: '11111111-1111-4111-8111-111111111218',
  wristExtension: '11111111-1111-4111-8111-111111111219',
  isometricHammerCurl: '11111111-1111-4111-8111-111111111220',
  gluteBridge: '11111111-1111-4111-8111-111111111221',
  hipHinge: '11111111-1111-4111-8111-111111111222',
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

export interface ProgramItem {
  exerciseId: string
  plannedSets: number
  targetReps?: number | null
  targetDurationS?: number | null
  targetDistanceM?: number | null
  restSeconds?: number | null
  notes?: string | null
  /** Items sharing a key become one circuit / superset on install. */
  circuit?: string | null
}

export interface ProgramTemplate {
  slot: HybridSlot
  name: string
  notes: string
  items: ProgramItem[]
}

const DAY_RULES =
  'Most work at RPE 7–8 — finish main lifts with 2–3 reps in reserve. Do not train to failure. Tendon work should feel almost boring: slow and controlled. Double progression: stay at a weight until every set hits the top of the rep range, then add a small jump.'

export const HYBRID_TEMPLATES: ProgramTemplate[] = [
  {
    slot: 'A',
    name: 'Hybrid A — Squat + Push/Pull + Carry',
    notes: `${HYBRID_PROGRAM_TAG} A\n\nSquat + push/pull + carry. ~70 min.\n${DAY_RULES}`,
    items: [
      {
        exerciseId: SYS.rowingMachine,
        plannedSets: 1,
        targetDurationS: 210,
        restSeconds: 0,
        notes: 'Warm-up. 3–4 min easy rower or bike.',
      },
      {
        exerciseId: SYS.bodyweightSquat,
        plannedSets: 2,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Warm-up circuit, 2 rounds.',
      },
      {
        exerciseId: SYS.walkingLunge,
        plannedSets: 2,
        targetReps: 6,
        restSeconds: 0,
        circuit: 'warmup',
        notes: '6 per side. Warm-up circuit.',
      },
      {
        exerciseId: SYS.bandPullApart,
        plannedSets: 2,
        targetReps: 15,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Warm-up circuit, 2 rounds.',
      },
      {
        exerciseId: SYS.scapularPushUp,
        plannedSets: 2,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Arms stay straight. Warm-up circuit.',
      },
      {
        exerciseId: SYS.externalRotation,
        plannedSets: 2,
        targetReps: 12,
        restSeconds: 30,
        circuit: 'warmup',
        notes: 'Band. 12 per side. Elbow pinned. This is also rotator-cuff work, not just a warm-up.',
      },
      {
        exerciseId: SYS.gobletSquat,
        plannedSets: 4,
        targetReps: 6,
        restSeconds: 120,
        notes:
          'Tempo 3-1-1. RPE 7–8. Feet ~shoulder-width, bell at the chest, brace before you descend, knees track the feet, whole foot stays down. When 4×6 with a heavy DB/KB is easy, swap to Front Squat.',
      },
      {
        exerciseId: SYS.dumbbellBenchPress,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 120,
        notes: '6–8 reps. Tempo 2-1-1. RPE 7–8. Elbows about 30–60° from the torso — not flared wide.',
      },
      {
        exerciseId: SYS.chestSupportedRow,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 90,
        notes: '8–10 reps. Pull 1s → hold 1s → lower 3s. Think “elbow toward hip”, not a hand yank.',
      },
      {
        exerciseId: SYS.bulgarianSplitSquat,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 90,
        notes: '8 per leg. Tempo 3-1-1. Left then right. Unilateral strength, balance, stability.',
      },
      {
        exerciseId: SYS.farmerCarry,
        plannedSets: 4,
        restSeconds: 75,
        notes:
          '30–40 m, fairly heavy. Tall posture, shoulders neutral, brace, short stable steps. Do not shrug. Log time; put distance in the set note.',
      },
      {
        exerciseId: SYS.externalRotation,
        plannedSets: 3,
        targetReps: 15,
        restSeconds: 60,
        notes:
          'Tendon A. Cable. 12–15 per arm. Tempo 2s out / 3s back. Elbow against the ribs (towel helps). Controlled, not to a burn.',
      },
      {
        exerciseId: SYS.wristExtension,
        plannedSets: 2,
        targetReps: 15,
        restSeconds: 45,
        notes: 'Tendon A. Per arm. Forearm supported. 3–4 s eccentric. Only the hand moves.',
      },
      {
        exerciseId: SYS.isometricHammerCurl,
        plannedSets: 3,
        targetDurationS: 25,
        restSeconds: 45,
        notes: 'Tendon A. 20–30 s. Elbow ~90°, hammer grip. Strong but controlled — not a max hold. No pain.',
      },
    ],
  },
  {
    slot: 'B',
    name: 'Hybrid B — Hinge + Vertical Push/Pull',
    notes: `${HYBRID_PROGRAM_TAG} B\n\nHinge + vertical push/pull. ~70–75 min.\n${DAY_RULES}`,
    items: [
      {
        exerciseId: SYS.stationaryBike,
        plannedSets: 1,
        targetDurationS: 210,
        restSeconds: 0,
        notes: 'Warm-up. 3–4 min easy bike.',
      },
      {
        exerciseId: SYS.gluteBridge,
        plannedSets: 2,
        targetReps: 12,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Warm-up circuit, 2 rounds.',
      },
      {
        exerciseId: SYS.hipHinge,
        plannedSets: 2,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Hips back, not a squat. Warm-up circuit.',
      },
      {
        exerciseId: SYS.kettlebellDeadlift,
        plannedSets: 2,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Warm-up circuit, 2 rounds. Light.',
      },
      {
        exerciseId: SYS.bandPullApart,
        plannedSets: 2,
        targetReps: 15,
        restSeconds: 0,
        circuit: 'warmup',
        notes: 'Warm-up circuit, 2 rounds.',
      },
      {
        exerciseId: SYS.externalRotation,
        plannedSets: 2,
        targetReps: 12,
        restSeconds: 30,
        circuit: 'warmup',
        notes: 'Band. 12 per side. Elbow pinned.',
      },
      {
        exerciseId: SYS.trapBarDeadlift,
        plannedSets: 4,
        targetReps: 5,
        restSeconds: 150,
        notes:
          'RPE 7–8. Rest 2–3 min. Brace → push the floor away → hips and shoulders rise together → stand tall. Do not lean back at the top. No trap bar? Swap to Deadlift.',
      },
      {
        exerciseId: SYS.landminePress,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 90,
        notes: '8 per arm. Start half-kneeling: opposite knee down. Shoulder + core stability.',
      },
      {
        exerciseId: SYS.latPulldown,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 90,
        notes:
          '8–10. Neutral grip. Tempo 2-1-3. Swap to Neutral-Grip Pull-Up 3×5–8 if you can do them cleanly.',
      },
      {
        exerciseId: SYS.romanianDeadlift,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 120,
        notes: 'RPE 7. Hips back, not a squat. Soft knees, bar close to the legs, spine neutral.',
      },
      {
        exerciseId: SYS.kettlebellSwing,
        plannedSets: 5,
        targetReps: 10,
        restSeconds: 50,
        notes:
          'Explosive, not a grind. Hip hinge → snap the hips → the bell floats. Not a squat and not an arm lift. End the set if speed drops.',
      },
      {
        exerciseId: SYS.rowingMachine,
        plannedSets: 1,
        targetDurationS: 540,
        restSeconds: 60,
        notes:
          'Conditioning. 6 rounds: 30 s hard / 60 s easy. “Hard” is about RPE 8, not an all-out sprint. Bike or SkiErg is fine.',
      },
      {
        exerciseId: SYS.facePull,
        plannedSets: 2,
        targetReps: 15,
        restSeconds: 45,
        notes: 'Tendon B. Controlled. Externally rotate at the end.',
      },
      {
        exerciseId: SYS.externalRotation,
        plannedSets: 2,
        targetReps: 15,
        restSeconds: 45,
        notes: 'Tendon B. Cable or band. 15 per arm. Slow.',
      },
      {
        exerciseId: SYS.tricepsPushdown,
        plannedSets: 2,
        targetReps: 12,
        restSeconds: 45,
        notes: 'Tendon B. Tempo 1–2 s extend / 4 s return.',
      },
      {
        exerciseId: SYS.wristPronationSupination,
        plannedSets: 2,
        targetReps: 12,
        restSeconds: 45,
        notes: 'Tendon B. Light DB. 12+12 per arm. Elbow 90°, forearm supported. Rotate the forearm only.',
      },
    ],
  },
  {
    slot: 'C',
    name: 'Hybrid C — Unilateral / Athletic',
    notes: `${HYBRID_PROGRAM_TAG} C\n\nMovement day — not a body-part split. Unilateral strength, anti-rotation, carries.\n${DAY_RULES}`,
    items: [
      {
        exerciseId: SYS.gobletSquat,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 90,
        notes: 'RPE 7. Goblet or Front Squat — keep this variation for 8–12 weeks.',
      },
      {
        exerciseId: SYS.singleLegRdl,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 90,
        notes: '8 per leg. Weight is not the point: balance + hinge + pelvis control.',
      },
      {
        exerciseId: SYS.oneArmDumbbellRow,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 75,
        notes: '8 per side. Rest 60–90 s.',
      },
      {
        exerciseId: SYS.halfKneelingCablePress,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 75,
        notes: '8 per side. Squeeze the down-knee glute, ribs down. Do not let the torso rotate.',
      },
      {
        exerciseId: SYS.stepUp,
        plannedSets: 3,
        targetReps: 8,
        restSeconds: 90,
        notes: '8 per leg. Box so the working thigh is about parallel. Front leg does the work — no push-off.',
      },
      {
        exerciseId: SYS.suitcaseCarry,
        plannedSets: 3,
        restSeconds: 75,
        notes:
          '30–40 m per side. One heavy DB/KB. Do not lean. Core stops side-bend. Log time; put distance in the set note.',
      },
      {
        exerciseId: SYS.pallofPress,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 60,
        notes: '10 per side. Hold 1–2 s at full extension. Do not let the cable turn you.',
      },
      {
        exerciseId: SYS.deadBug,
        plannedSets: 2,
        targetReps: 8,
        restSeconds: 45,
        notes: '8 per side. Slow. Low back stays on the floor. Exhale as you reach. Shorten the range if it peels up.',
      },
      {
        exerciseId: SYS.kettlebellSwing,
        plannedSets: 3,
        targetReps: 12,
        restSeconds: 0,
        circuit: 'finisher',
        notes: 'Finisher, 3 rounds (later 4). Quality over wreckage — round 3 should look like round 1.',
      },
      {
        exerciseId: SYS.pushUp,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'finisher',
        notes: 'Finisher circuit.',
      },
      {
        exerciseId: SYS.walkingLunge,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'finisher',
        notes: 'Finisher. 10 total steps.',
      },
      {
        exerciseId: SYS.rowingMachine,
        plannedSets: 3,
        targetDistanceM: 200,
        restSeconds: 60,
        circuit: 'finisher',
        notes: 'Finisher. 200 m, then 60 s rest before the next round.',
      },
    ],
  },
  {
    slot: 'D',
    name: 'Hybrid D — Longevity',
    notes: `${HYBRID_PROGRAM_TAG} D\n\nIntentionally easier day. Functional circuit + Zone 2 + the fullest tendon block.\nKeep circuit RPE around 6–7. Tendon work stays slow and pain-free.`,
    items: [
      {
        exerciseId: SYS.gobletSquat,
        plannedSets: 4,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'circuit',
        notes: 'Functional circuit, 4 rounds. RPE 6–7.',
      },
      {
        exerciseId: SYS.invertedRow,
        plannedSets: 4,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'circuit',
        notes: 'TRX or bar — same row. Circuit.',
      },
      {
        exerciseId: SYS.pushUp,
        plannedSets: 4,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'circuit',
        notes: 'Circuit.',
      },
      {
        exerciseId: SYS.kettlebellDeadlift,
        plannedSets: 4,
        targetReps: 10,
        restSeconds: 0,
        circuit: 'circuit',
        notes: 'Circuit.',
      },
      {
        exerciseId: SYS.farmerCarry,
        plannedSets: 4,
        restSeconds: 75,
        circuit: 'circuit',
        notes: 'Circuit. ~30 m. 60–90 s rest between rounds.',
      },
      {
        exerciseId: SYS.stationaryBike,
        plannedSets: 1,
        targetDurationS: 1500,
        restSeconds: 60,
        notes:
          'Zone 2. 25–30 min bike, incline treadmill, or rower. Talk test: you can speak in sentences but you are training. Do not chase a heart-rate number yet.',
      },
      {
        exerciseId: SYS.externalRotation,
        plannedSets: 3,
        targetReps: 15,
        restSeconds: 45,
        notes: 'Tendon day. Cable. 15 per arm. Elbow pinned. Slow. Progress later toward 90/90 if it stays comfortable.',
      },
      {
        exerciseId: SYS.scaptionRaise,
        plannedSets: 3,
        targetReps: 12,
        restSeconds: 45,
        notes: 'Very light. Arms 30–45° between front and side, thumbs up, to shoulder height.',
      },
      {
        exerciseId: SYS.wristExtension,
        plannedSets: 3,
        targetReps: 15,
        restSeconds: 45,
        notes: 'Reverse wrist curl. Forearm fully supported. Tempo 1–2 s up / 4 s down.',
      },
      {
        exerciseId: SYS.hammerCurl,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 60,
        notes: 'Tempo 2 s up / 4 s down. No swinging.',
      },
      {
        exerciseId: SYS.tricepsPushdown,
        plannedSets: 3,
        targetReps: 12,
        restSeconds: 60,
        notes: '10–12. Tempo 2 s extend / 4 s return. RPE ~7.',
      },
      {
        exerciseId: SYS.wristPronationSupination,
        plannedSets: 2,
        targetReps: 12,
        restSeconds: 45,
        notes: '12 each way per arm. Very light (1–3 kg). Hold one end of the DB to lengthen the lever.',
      },
      {
        exerciseId: SYS.deadHang,
        plannedSets: 3,
        targetDurationS: 30,
        restSeconds: 60,
        notes: '20–40 s. Only if the shoulder is fully comfortable. Keep a little scapular tone if a dead hang feels bad.',
      },
      {
        exerciseId: SYS.standingCalfRaise,
        plannedSets: 3,
        targetReps: 10,
        restSeconds: 60,
        notes: '8–12. Heavier. Tempo 2 s up → 1 s hold → 3 s down.',
      },
      {
        exerciseId: SYS.seatedCalfRaise,
        plannedSets: 3,
        targetReps: 15,
        restSeconds: 60,
        notes: '12–15. Tempo 2-1-3. Soleus / Achilles work — tendon day is not only shoulders and elbows.',
      },
    ],
  },
]

const SLOT_RE = new RegExp(`^${HYBRID_PROGRAM_TAG} ([ABCD])\\b`)
const NAME_RE = /^Hybrid ([ABCD])\b/

function asSlot(value: string | undefined): HybridSlot | null {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' ? value : null
}

export function hybridSlotFromNotes(notes: string | null | undefined): HybridSlot | null {
  if (!notes) return null
  return asSlot(notes.match(SLOT_RE)?.[1])
}

export function hybridSlotFromTemplate(template: Pick<TemplateRow, 'name' | 'notes'>): HybridSlot | null {
  return hybridSlotFromNotes(template.notes) ?? asSlot(template.name.match(NAME_RE)?.[1])
}

export function hybridTemplatesFrom(
  templates: Pick<TemplateRow, 'id' | 'name' | 'notes'>[],
): Record<HybridSlot, Pick<TemplateRow, 'id' | 'name' | 'notes'>> | null {
  const found: Partial<Record<HybridSlot, Pick<TemplateRow, 'id' | 'name' | 'notes'>>> = {}
  for (const template of templates) {
    const slot = hybridSlotFromTemplate(template)
    if (slot) found[slot] = template
  }
  if (found.A && found.B && found.C && found.D) {
    return found as Record<HybridSlot, Pick<TemplateRow, 'id' | 'name' | 'notes'>>
  }
  return null
}

export function isHybridProgramInstalled(
  templates: Pick<TemplateRow, 'id' | 'name' | 'notes'>[],
): boolean {
  return hybridTemplatesFrom(templates) !== null
}

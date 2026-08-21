import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const STREET_PROGRAM_TAG = 'Program: Street 3-day'
export const STREET_SOURCE_KEY = 'street-3-day'
export const STREET_SOURCE_VERSION = 1
export const STREET_PLAN_NAME = 'Street 3-day'
export const STREET_PLAN_NOTES =
  'Street workout: pull-up and dip bars, bodyweight, optional dumbbells up to 15 kg each. Three days (A–C), ~45–60 min. No gym machines.'

const RULES =
  'Most work at RPE 6–8. Pull-up and dip regressions (negatives, feet-assisted, jumping) are the program — not a failure. Dumbbells, if used, stay at or below 15 kg each.'
const DB_CAP = 'Optional. Cap 15 kg per dumbbell.'

export const STREET_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Street A — Push',
    notes: `${STREET_PROGRAM_TAG} A\n\nPush-up, pike, dips, core. ~50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.wristCircles, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.scapularPushUp, plannedSets: 2, reps: [8, 10], rpe: [4, 5], restSeconds: 30, tempo: controlled(2, 0, 2, 0), notes: 'Elbows locked. Shoulder blades squeeze and spread.' },
          { exerciseId: SYS.deadHang, plannedSets: 1, durationS: [15, 30], rpe: [4, 5], restSeconds: 30, tempo: controlled(0, 0, 0, 0), notes: 'Pain-free only.' },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.pushUp, plannedSets: 4, reps: [6, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 90, tempo: controlled(2, 1, 1, 0), notes: 'Hands on a bar or bench if the floor set is too hard. Elevate the feet when 12 is easy at RPE 7.' }],
      },
      {
        key: 'vertical_push', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.pikePushUp, plannedSets: 3, reps: [5, 8], rpe: [7, 8], restSeconds: 90, tempo: controlled(3, 0, 1, 0), notes: 'Hips high. Hands on the ground or a low bar. This is the overhead-press pattern.' }],
      },
      {
        key: 'dips', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.dip, plannedSets: 3, reps: [4, 10], rpe: [7, 8], restSeconds: 90, tempo: controlled(3, 0, 1, 0), notes: 'Parallel bars. Feet-assisted or shortened range if you cannot do 4 clean reps. Do not chase shoulder pain.' }],
      },
      {
        key: 'optional_db', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.dbShoulderPress, plannedSets: 2, reps: [8, 12], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0), notes: `${DB_CAP} Skip this block if you have no dumbbells.` }],
      },
      {
        key: 'core', role: 'core', format: 'straight',
        items: [
          { exerciseId: SYS.hangingLegRaise, plannedSets: 3, reps: [5, 10], rpe: [6, 7], restSeconds: 60, tempo: controlled(3, 0, 1, 0), notes: 'Knees first if straight legs swing. No kip.' },
          { exerciseId: SYS.hollowHold, plannedSets: 2, durationS: [15, 30], rpe: [6, 7], restSeconds: 45, tempo: controlled(0, 0, 0, 0) },
        ],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Street B — Pull',
    notes: `${STREET_PROGRAM_TAG} B\n\nPull-up, row, chin-up, hinge. ~50–55 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.deadHang, plannedSets: 2, durationS: [15, 25], rpe: [4, 5], restSeconds: 30, tempo: controlled(0, 0, 0, 0) },
          { exerciseId: SYS.bandPullApart, plannedSets: 1, reps: [12, 15], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 2, 0), notes: 'Skip if you have no band and do extra scapular hangs.' },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.pullUp, plannedSets: 4, reps: [3, 8], rpe: [7, 8], rir: [1, 3], restSeconds: 150, tempo: controlled(3, 0, 1, 0), notes: 'Chin over the bar, lower to a hang. Negatives (jump, 3–5 s lower) or jumping pull-ups if you cannot yet do 3.' }],
      },
      {
        key: 'row', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.invertedRow, plannedSets: 3, reps: [6, 12], rpe: [7, 8], restSeconds: 75, tempo: controlled(3, 0, 1, 1), notes: 'Low bar or rings. More horizontal = harder. Australian pull-up.' }],
      },
      {
        key: 'chin', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.chinUp, plannedSets: 3, reps: [3, 8], rpe: [7, 8], restSeconds: 90, tempo: controlled(3, 0, 1, 0), notes: 'Underhand. Same regressions as the pull-up.' }],
      },
      {
        key: 'hinge', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.dbRdl, plannedSets: 3, reps: [8, 10], rpe: [6, 7], restSeconds: 75, loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0), notes: `${DB_CAP} Single-leg RDL with bodyweight if you have no dumbbells.` }],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 3, distanceM: [20, 40], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(1, 0, 1, 0), notes: `${DB_CAP} Suitcase carry one side at a time if you have a single bell.` }],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.wristExtension, plannedSets: 2, reps: [12, 15], rpe: [5, 6], restSeconds: 40, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 1, 0), notes: `${DB_CAP} Very light. Skip if no dumbbells.` },
          { exerciseId: SYS.deadHang, plannedSets: 2, durationS: [20, 40], rpe: [4, 6], restSeconds: 45, tempo: controlled(0, 0, 0, 0), notes: 'Grip + shoulder. Pain-free only.' },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Street C — Legs + Skill',
    notes: `${STREET_PROGRAM_TAG} C\n\nSquat pattern, lunge, pistol progression, short circuit. ~50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipHinge, plannedSets: 1, reps: [8, 8], rpe: [3, 4], restSeconds: 15, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.hipFlexorStretch, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.bodyweightSquat, plannedSets: 1, reps: [10, 15], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 1, 0) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.gobletSquat, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 90, loadIncrementKg: 1, tempo: controlled(3, 0, 1, 0), notes: `${DB_CAP} Bodyweight squat or pause squats if you have no bells.` }],
      },
      {
        key: 'unilateral', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.walkingLunge, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0), notes: `${DB_CAP} Bulgarian split squat on a bench or wall is an allowed swap.` }],
      },
      {
        key: 'skill', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.pistolSquat, plannedSets: 2, reps: [3, 6], rpe: [6, 7], restSeconds: 75, sideMode: 'per_leg', tempo: controlled(3, 0, 1, 0), notes: 'Box / bench pistol or assisted to a support. Full pistols only if they are clean.' }],
      },
      {
        key: 'circuit', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 3, restAfterRoundS: 60,
        notes: 'Three easy-hard rounds. Stop if the last round no longer looks like the first.',
        items: [
          { exerciseId: SYS.pullUp, plannedSets: 1, reps: [3, 6], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0), notes: 'Easier than day B. Jumping reps are fine.' },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [8, 12], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.bodyweightSquat, plannedSets: 1, reps: [10, 15], rpe: [6, 7], restSeconds: 0, tempo: controlled(2, 0, 1, 0) },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.jumpRope, plannedSets: 1, durationS: [480, 720], rpe: [5, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '8–12 min easy. Outdoor walk 20 min is the swap if you have no rope.' }],
      },
    ],
  },
])

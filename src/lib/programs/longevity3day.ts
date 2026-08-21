import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const LONGEVITY_PROGRAM_TAG = 'Program: Longevity 3-day'
export const LONGEVITY_SOURCE_KEY = 'longevity-3-day'
export const LONGEVITY_SOURCE_VERSION = 1
export const LONGEVITY_PLAN_NAME = 'Longevity 3-day'
export const LONGEVITY_PLAN_NOTES =
  'Joint-first strength plus Zone 2. Three days (A–C), ~45–60 min, RPE 5–7. Machines and dumbbells. For returning to training or training past 50.'

const RULES =
  'Most work at RPE 5–7. Never grind. Pain-free range only. Add load slowly after the top of the range is easy.'

export const LONGEVITY_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Longevity A — Squat + Press',
    notes: `${LONGEVITY_PROGRAM_TAG} A\n\nMachine/goblet squat, press, row, Zone 2. ~50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.catCow, plannedSets: 1, durationS: [45, 60], rpe: [3, 4], restSeconds: 10, tempo: controlled(3, 0, 3, 0) },
          { exerciseId: SYS.thoracicRotation, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0) },
          { exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 20, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.gobletSquat, plannedSets: 3, reps: [8, 10], rpe: [6, 7], rir: [3, 4], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Leg press or chest-supported machine squat if the back prefers it.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.chestPressMachine, plannedSets: 3, reps: [8, 12], rpe: [6, 7], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 0), notes: 'DB bench is an allowed swap.' },
          { exerciseId: SYS.seatedCableRow, plannedSets: 3, reps: [8, 12], rpe: [6, 7], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 1) },
        ],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 2, distanceM: [20, 30], rpe: [5, 6], restSeconds: 60, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Easy, tall walk.' }],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [1200, 1500], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '20–25 min. Talk test.' }],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Longevity B — Hinge + Tendon',
    notes: `${LONGEVITY_PROGRAM_TAG} B\n\nEasy hinge, pulldown, split squat, tendon. ~50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipHinge, plannedSets: 1, reps: [8, 8], rpe: [3, 4], restSeconds: 15, tempo: controlled(3, 0, 2, 0) },
          { exerciseId: SYS.gluteBridge, plannedSets: 2, reps: [8, 12], rpe: [4, 5], restSeconds: 30, tempo: controlled(2, 1, 1, 1) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.dbRdl, plannedSets: 3, reps: [8, 10], rpe: [6, 7], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Kettlebell deadlift is an allowed swap. Stop if the low back rounds.' }],
      },
      {
        key: 'pull_leg', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.latPulldown, plannedSets: 3, reps: [8, 12], rpe: [6, 7], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(3, 0, 2, 1) },
          { exerciseId: SYS.stepUp, plannedSets: 3, reps: [6, 8], rpe: [6, 7], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(2, 0, 1, 0), notes: 'Low box. Drive through the front foot.' },
        ],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.externalRotation, plannedSets: 2, reps: [12, 15], rpe: [5, 6], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0) },
          { exerciseId: SYS.wristExtension, plannedSets: 2, reps: [12, 15], rpe: [5, 6], restSeconds: 40, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(4, 0, 1, 0) },
          { exerciseId: SYS.standingCalfRaise, plannedSets: 2, reps: [10, 12], rpe: [6, 7], restSeconds: 45, loadIncrementKg: 2.5, tempo: controlled(3, 1, 2, 1), notes: 'Full pause at the bottom.' },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Longevity C — Easy Circuit + Walk',
    notes: `${LONGEVITY_PROGRAM_TAG} C\n\nEasy circuit, longer Zone 2, mobility. ~50–60 min.\n${RULES}`,
    blocks: [
      {
        key: 'circuit', role: 'conditioning', format: 'circuit', roundsInitial: 3, roundsMax: 3, restAfterRoundS: 75,
        notes: 'Three easy rounds at RPE 5–6.',
        items: [
          { exerciseId: SYS.gobletSquat, plannedSets: 1, reps: [8, 8], rpe: [5, 6], restSeconds: 0, tempo: controlled(3, 0, 1, 0) },
          { exerciseId: SYS.seatedCableRow, plannedSets: 1, reps: [8, 10], rpe: [5, 6], restSeconds: 0, tempo: controlled(3, 0, 1, 1) },
          { exerciseId: SYS.pushUp, plannedSets: 1, reps: [5, 10], rpe: [5, 6], restSeconds: 0, tempo: controlled(2, 0, 1, 0), notes: 'Hands on a bench if needed.' },
          { exerciseId: SYS.gluteBridge, plannedSets: 1, reps: [8, 10], rpe: [5, 6], restSeconds: 0, tempo: controlled(2, 0, 1, 1) },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [1500, 2100], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '25–35 min. Outdoor walk is an allowed swap.' }],
      },
      {
        key: 'mobility', role: 'warmup', format: 'straight',
        notes: 'Finish here. Slow breathing.',
        items: [
          { exerciseId: SYS.hipFlexorStretch, plannedSets: 1, durationS: [40, 50], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0) },
          { exerciseId: SYS.pigeonStretch, plannedSets: 1, durationS: [40, 50], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0) },
          { exerciseId: SYS.hamstringStretch, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0) },
        ],
      },
    ],
  },
])

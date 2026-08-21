import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const FOUNDATIONS_PROGRAM_TAG = 'Program: Foundations 3-day'
export const FOUNDATIONS_SOURCE_KEY = 'foundations-3-day'
export const FOUNDATIONS_SOURCE_VERSION = 1
export const FOUNDATIONS_PLAN_NAME = 'Foundations 3-day'
export const FOUNDATIONS_PLAN_NOTES =
  'Beginner full-body. Three days (A–C), ~45–55 min, RPE 6–7. Goblet squat, hinge, press, row. Standard gym; machines are allowed swaps. No trap bar or landmine required.'

const RULES =
  'Most work at RPE 6–7. Leave 3+ reps in reserve. Add load only after every work set reaches the top of its range at RPE 7 or lower.'

export const FOUNDATIONS_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Foundations A — Squat + Press',
    notes: `${FOUNDATIONS_PROGRAM_TAG} A\n\nGoblet squat, bench, row, carry. ~50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: '3–5 minutes easy bike or walk, then this preparation.',
        items: [
          { exerciseId: SYS.catCow, plannedSets: 1, durationS: [45, 60], rpe: [3, 4], restSeconds: 15, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.hipHinge, plannedSets: 1, reps: [8, 8], rpe: [3, 4], restSeconds: 20, tempo: controlled(2, 0, 2, 0), notes: 'Pattern only — no load.' },
          { exerciseId: SYS.externalRotation, plannedSets: 1, reps: [10, 12], rpe: [4, 5], restSeconds: 20, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Light band. Elbow pinned.' },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.gobletSquat, plannedSets: 3, reps: [8, 10], rpe: [6, 7], rir: [3, 4], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0), notes: 'Elbows inside the knees. Leg press is an allowed swap if the back is not ready for a squat.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        notes: 'Alternate press and row. Rest after both.',
        items: [
          { exerciseId: SYS.dumbbellBenchPress, plannedSets: 3, reps: [8, 10], rpe: [6, 7], rir: [3, 4], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0), notes: 'Machine chest press is an allowed swap.' },
          { exerciseId: SYS.seatedCableRow, plannedSets: 3, reps: [8, 12], rpe: [6, 7], rir: [3, 4], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 1), notes: 'Chest-supported row if the low back fatigues.' },
        ],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 3, distanceM: [20, 30], rpe: [6, 7], restSeconds: 60, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Tall walk. Log load and distance.' }],
      },
      {
        key: 'core', role: 'core', format: 'straight',
        items: [{ exerciseId: SYS.plank, plannedSets: 2, durationS: [20, 40], rpe: [5, 6], restSeconds: 45, tempo: controlled(0, 0, 0, 0), notes: 'Stop if the hips sag.' }],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Foundations B — Hinge + Pull',
    notes: `${FOUNDATIONS_PROGRAM_TAG} B\n\nHinge, pulldown, press, face pull. ~50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipHinge, plannedSets: 1, reps: [8, 8], rpe: [3, 4], restSeconds: 20, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.bandPullApart, plannedSets: 1, reps: [12, 15], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 2, 0) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.dbRdl, plannedSets: 3, reps: [8, 10], rpe: [6, 7], rir: [3, 4], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Soft knees, bar-path close. Kettlebell deadlift is an allowed swap.' }],
      },
      {
        key: 'vertical', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        items: [
          { exerciseId: SYS.latPulldown, plannedSets: 3, reps: [8, 12], rpe: [6, 7], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(3, 0, 2, 1), notes: 'Neutral grip if it feels better on the elbows.' },
          { exerciseId: SYS.dbShoulderPress, plannedSets: 3, reps: [8, 10], rpe: [6, 7], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(2, 0, 1, 0), notes: 'Ribs down. Landmine or machine press is an allowed swap.' },
        ],
      },
      {
        key: 'tendon', role: 'tendon', format: 'straight',
        items: [
          { exerciseId: SYS.facePull, plannedSets: 2, reps: [12, 15], rpe: [5, 6], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(3, 0, 2, 1) },
          { exerciseId: SYS.externalRotation, plannedSets: 2, reps: [12, 15], rpe: [5, 6], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 0.5, tempo: controlled(3, 0, 2, 0) },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Foundations C — Unilateral + Easy Cardio',
    notes: `${FOUNDATIONS_PROGRAM_TAG} C\n\nSplit squat, row, push-up, Zone 2. ~50–55 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipFlexorStretch, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.gluteBridge, plannedSets: 1, reps: [10, 12], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 1, 1) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [6, 8], rpe: [6, 7], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0), notes: 'Bodyweight first if balance is the limiter. Log both legs together.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.pushUp, plannedSets: 3, reps: [6, 12], rpe: [6, 7], restSeconds: 75, tempo: controlled(2, 0, 1, 0), notes: 'Hands on a bench if the floor version is too hard.' },
          { exerciseId: SYS.oneArmDumbbellRow, plannedSets: 3, reps: [8, 10], rpe: [6, 7], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1) },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.stationaryBike, plannedSets: 1, durationS: [1200, 1500], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '20–25 min. Talk test: you can still speak in sentences. Treadmill walk is an allowed swap.' }],
      },
    ],
  },
])

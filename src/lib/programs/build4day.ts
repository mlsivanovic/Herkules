import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const BUILD_PROGRAM_TAG = 'Program: Build 4-day'
export const BUILD_SOURCE_KEY = 'build-4-day'
export const BUILD_SOURCE_VERSION = 1
export const BUILD_PLAN_NAME = 'Build 4-day'
export const BUILD_PLAN_NOTES =
  'Hypertrophy upper/lower. Four days (A–D), ~50–65 min, mostly 8–12 reps at RPE 7–8. Standard gym. No trap bar required.'

const RULES =
  'Most work at RPE 7–8 with 2–3 reps in reserve. Add load only after every work set reaches the top of its range at RPE 8 or lower.'

export const BUILD_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Build A — Upper 1',
    notes: `${BUILD_PROGRAM_TAG} A\n\nHorizontal press/pull, laterals, arms. ~55 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [{ exerciseId: SYS.bandPullApart, plannedSets: 1, reps: [15, 15], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 2, 0) }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.barbellBenchPress, plannedSets: 4, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 2.5, tempo: controlled(2, 1, 1, 0), notes: 'DB bench is an allowed swap.' }],
      },
      {
        key: 'row', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.chestSupportedRow, plannedSets: 4, reps: [8, 10], rpe: [7, 8], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1) }],
      },
      {
        key: 'vertical', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.overheadPress, plannedSets: 3, reps: [6, 8], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.latPulldown, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(3, 0, 2, 1) },
        ],
      },
      {
        key: 'isolation', role: 'assistance', format: 'straight',
        items: [
          { exerciseId: SYS.lateralRaise, plannedSets: 3, reps: [12, 15], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1) },
          { exerciseId: SYS.dbCurl, plannedSets: 2, reps: [10, 12], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1) },
          { exerciseId: SYS.tricepsPushdown, plannedSets: 2, reps: [10, 12], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 2.5, tempo: controlled(2, 0, 1, 1) },
        ],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Build B — Lower 1',
    notes: `${BUILD_PROGRAM_TAG} B\n\nSquat, hinge, lunge, curl, calf. ~55–60 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipFlexorStretch, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.bodyweightSquat, plannedSets: 1, reps: [10, 10], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 1, 0) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.barbellBackSquat, plannedSets: 4, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0), notes: 'Hack squat or leg press if the back is not ready.' }],
      },
      {
        key: 'hinge', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.romanianDeadlift, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 120, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0) }],
      },
      {
        key: 'unilateral', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.walkingLunge, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(2, 0, 1, 0) }],
      },
      {
        key: 'isolation', role: 'assistance', format: 'straight',
        items: [
          { exerciseId: SYS.lyingLegCurl, plannedSets: 3, reps: [10, 12], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 1) },
          { exerciseId: SYS.standingCalfRaise, plannedSets: 3, reps: [10, 15], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 2.5, tempo: controlled(2, 1, 1, 1) },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Build C — Upper 2',
    notes: `${BUILD_PROGRAM_TAG} C\n\nIncline, row, fly, rear delt, arms. ~55 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [12, 12], rpe: [4, 5], restSeconds: 20, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0) }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.inclineDbBench, plannedSets: 4, reps: [8, 10], rpe: [7, 8], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0) }],
      },
      {
        key: 'row', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.oneArmDumbbellRow, plannedSets: 4, reps: [8, 12], rpe: [7, 8], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1) }],
      },
      {
        key: 'fly_face', role: 'assistance', format: 'superset', restAfterRoundS: 60,
        items: [
          { exerciseId: SYS.dumbbellBenchPress, plannedSets: 2, reps: [10, 12], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Lighter than day A. A fly is an allowed swap.' },
          { exerciseId: SYS.facePull, plannedSets: 3, reps: [12, 15], rpe: [6, 7], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(3, 0, 2, 1) },
        ],
      },
      {
        key: 'isolation', role: 'assistance', format: 'straight',
        items: [
          { exerciseId: SYS.rearDeltFly, plannedSets: 2, reps: [12, 15], rpe: [6, 7], restSeconds: 40, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1) },
          { exerciseId: SYS.hammerCurl, plannedSets: 2, reps: [10, 12], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1) },
          { exerciseId: SYS.overheadTriceps, plannedSets: 2, reps: [10, 12], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 1, tempo: controlled(3, 0, 1, 0) },
        ],
      },
    ],
  },
  {
    slot: 'D',
    name: 'Build D — Lower 2',
    notes: `${BUILD_PROGRAM_TAG} D\n\nHip thrust / leg press, split squat, quads, calf, core. ~50–55 min.\n${RULES}`,
    blocks: [
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.barbellHipThrust, plannedSets: 4, reps: [8, 10], rpe: [7, 8], restSeconds: 120, loadIncrementKg: 5, tempo: controlled(2, 0, 1, 1), notes: 'Leg press is an allowed swap.' }],
      },
      {
        key: 'unilateral', role: 'assistance', format: 'straight',
        items: [{ exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0) }],
      },
      {
        key: 'isolation', role: 'assistance', format: 'straight',
        items: [
          { exerciseId: SYS.legExtension, plannedSets: 3, reps: [10, 15], rpe: [7, 8], restSeconds: 50, loadIncrementKg: 2.5, tempo: controlled(2, 1, 1, 1) },
          { exerciseId: SYS.seatedCalfRaise, plannedSets: 3, reps: [12, 15], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 2.5, tempo: controlled(2, 1, 1, 1) },
        ],
      },
      {
        key: 'core', role: 'core', format: 'straight',
        items: [
          { exerciseId: SYS.deadBug, plannedSets: 2, reps: [8, 8], rpe: [5, 6], restSeconds: 40, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0) },
          { exerciseId: SYS.pallofPress, plannedSets: 2, reps: [8, 10], rpe: [6, 7], restSeconds: 40, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 2, 2) },
        ],
      },
    ],
  },
])

import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const HOME_PROGRAM_TAG = 'Program: Home 3-day'
export const HOME_SOURCE_KEY = 'home-3-day'
export const HOME_SOURCE_VERSION = 1
export const HOME_PLAN_NAME = 'Home 3-day'
export const HOME_PLAN_NOTES =
  'Apartment training. Three days (A–C), ~40–50 min. Dumbbells, a band, and floor space. No barbell, cables, or machines.'

const RULES =
  'Most work at RPE 6–8. Add load only after every work set reaches the top of its range with 2+ reps in reserve.'

export const HOME_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Home A — Squat + Push',
    notes: `${HOME_PROGRAM_TAG} A\n\nGoblet squat, floor/DB press, row, carry. ~45 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.catCow, plannedSets: 1, durationS: [40, 60], rpe: [3, 4], restSeconds: 10, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.bandPullApart, plannedSets: 1, reps: [12, 15], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 0, 2, 0), notes: 'A towel pull-apart works if you have no band.' },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.gobletSquat, plannedSets: 3, reps: [8, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0), notes: 'Hold one dumbbell at the chest. Bodyweight squat if the bells are too heavy to goblet well.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.dumbbellBenchPress, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0), notes: 'Floor press if you have no bench: lower until the triceps touch the floor.' },
          { exerciseId: SYS.oneArmDumbbellRow, plannedSets: 3, reps: [8, 12], rpe: [7, 8], restSeconds: 75, sideMode: 'per_side', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1), notes: 'Brace on a chair or sofa back.' },
        ],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 3, distanceM: [20, 40], rpe: [7, 8], restSeconds: 60, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0), notes: 'Hallway walks count. Log load and distance.' }],
      },
      {
        key: 'core', role: 'core', format: 'straight',
        items: [{ exerciseId: SYS.deadBug, plannedSets: 2, reps: [6, 8], rpe: [5, 6], restSeconds: 40, sideMode: 'per_side', tempo: controlled(3, 0, 3, 0) }],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Home B — Hinge + Overhead',
    notes: `${HOME_PROGRAM_TAG} B\n\nDB RDL, shoulder press, row, curls. ~45 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipHinge, plannedSets: 1, reps: [8, 8], rpe: [3, 4], restSeconds: 15, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.externalRotation, plannedSets: 1, reps: [10, 12], rpe: [4, 5], restSeconds: 20, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Band. Skip if you have none and do extra pull-aparts.' },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.dbRdl, plannedSets: 3, reps: [8, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0), notes: 'Two dumbbells, close to the legs.' }],
      },
      {
        key: 'vertical', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.dbShoulderPress, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2, tempo: controlled(2, 0, 1, 0), notes: 'Seated on a chair if standing is unstable.' },
          { exerciseId: SYS.invertedRow, plannedSets: 3, reps: [6, 12], rpe: [7, 8], restSeconds: 75, tempo: controlled(3, 0, 1, 1), notes: 'Table / sturdy bar row. One-arm DB row is the swap if you cannot hang under anything.' },
        ],
      },
      {
        key: 'arms', role: 'assistance', format: 'straight',
        items: [
          { exerciseId: SYS.hammerCurl, plannedSets: 2, reps: [10, 12], rpe: [7, 7], restSeconds: 50, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1) },
          { exerciseId: SYS.overheadTriceps, plannedSets: 2, reps: [8, 12], rpe: [7, 7], restSeconds: 50, loadIncrementKg: 1, tempo: controlled(3, 0, 1, 0), notes: 'One dumbbell, both hands.' },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Home C — Unilateral + Walk',
    notes: `${HOME_PROGRAM_TAG} C\n\nSplit squat, push-up, single-leg hinge, walk. ~40–50 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [
          { exerciseId: SYS.hipFlexorStretch, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.gluteBridge, plannedSets: 2, reps: [10, 12], rpe: [5, 6], restSeconds: 30, tempo: controlled(2, 0, 1, 1) },
        ],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [6, 10], rpe: [7, 8], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0), notes: 'Rear foot on a chair. Walking lunge is an allowed swap.' }],
      },
      {
        key: 'push_hinge', role: 'assistance', format: 'superset', restAfterRoundS: 60,
        items: [
          { exerciseId: SYS.pushUp, plannedSets: 3, reps: [6, 15], rpe: [7, 8], restSeconds: 60, tempo: controlled(2, 0, 1, 0), notes: 'Hands on a sofa edge if the floor version is too hard; feet elevated if 15 is easy.' },
          { exerciseId: SYS.singleLegRdl, plannedSets: 3, reps: [6, 8], rpe: [6, 7], restSeconds: 60, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0), notes: 'Bodyweight or one light dumbbell. Balance before load.' },
        ],
      },
      {
        key: 'zone2', role: 'zone_2', format: 'straight',
        items: [{ exerciseId: SYS.outdoorWalk, plannedSets: 1, durationS: [1200, 1800], rpe: [4, 6], restSeconds: 0, tempo: controlled(0, 0, 0, 0), notes: '20–30 min brisk walk. Jump rope 10–15 min is an indoor swap.' }],
      },
    ],
  },
])

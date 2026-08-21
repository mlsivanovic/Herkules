import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const BUSY_PROGRAM_TAG = 'Program: Busy 3-day'
export const BUSY_SOURCE_KEY = 'busy-3-day'
export const BUSY_SOURCE_VERSION = 1
export const BUSY_PLAN_NAME = 'Busy 3-day'
export const BUSY_PLAN_NOTES =
  'Time-crunched gym training. Three days (A–C), ~30–40 min. One main lift, one push/pull superset, done. Standard gym.'

const RULES =
  'Most work at RPE 7–8. Rest long enough to keep the main lift crisp. Skip extras — this program is short on purpose.'

export const BUSY_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Busy A — Squat + Upper',
    notes: `${BUSY_PROGRAM_TAG} A\n\nSquat, bench, row. ~35 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [{ exerciseId: SYS.externalRotation, plannedSets: 1, reps: [10, 12], rpe: [4, 5], restSeconds: 20, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Plus 2–3 empty-bar squat sets.' }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.barbellBackSquat, plannedSets: 3, reps: [5, 6], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 2.5, tempo: controlled(3, 0, 1, 0), notes: 'Goblet squat or leg press if you are not ready for a back squat.' }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        items: [
          { exerciseId: SYS.barbellBenchPress, plannedSets: 3, reps: [5, 8], rpe: [7, 8], restSeconds: 90, loadIncrementKg: 2.5, tempo: controlled(2, 1, 1, 0), notes: 'DB bench is an allowed swap.' },
          { exerciseId: SYS.chestSupportedRow, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 90, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1), notes: 'Seated cable row is an allowed swap.' },
        ],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Busy B — Hinge + Vertical',
    notes: `${BUSY_PROGRAM_TAG} B\n\nHinge, pulldown, press. ~35 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        items: [{ exerciseId: SYS.hipHinge, plannedSets: 1, reps: [6, 8], rpe: [3, 4], restSeconds: 15, tempo: controlled(2, 0, 2, 0) }],
      },
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.romanianDeadlift, plannedSets: 3, reps: [6, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 150, loadIncrementKg: 2.5, tempo: controlled(3, 1, 1, 0), notes: 'Conventional deadlift 3×5 is an allowed swap if you recover well.' }],
      },
      {
        key: 'vertical', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        items: [
          { exerciseId: SYS.latPulldown, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(3, 0, 2, 1) },
          { exerciseId: SYS.overheadPress, plannedSets: 3, reps: [5, 8], rpe: [7, 8], restSeconds: 75, loadIncrementKg: 2.5, tempo: controlled(2, 0, 1, 0), notes: 'DB shoulder press is an allowed swap.' },
        ],
      },
    ],
  },
  {
    slot: 'C',
    name: 'Busy C — Unilateral + Carry',
    notes: `${BUSY_PROGRAM_TAG} C\n\nSplit squat, push-up, row, carry. ~30–35 min.\n${RULES}`,
    blocks: [
      {
        key: 'strength', role: 'strength', format: 'straight',
        items: [{ exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [6, 8], rpe: [7, 8], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0) }],
      },
      {
        key: 'push_pull', role: 'assistance', format: 'superset', restAfterRoundS: 60,
        items: [
          { exerciseId: SYS.pushUp, plannedSets: 3, reps: [8, 15], rpe: [7, 8], restSeconds: 60, tempo: controlled(2, 0, 1, 0) },
          { exerciseId: SYS.oneArmDumbbellRow, plannedSets: 3, reps: [8, 10], rpe: [7, 8], restSeconds: 60, sideMode: 'per_side', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1) },
        ],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        items: [{ exerciseId: SYS.farmerCarry, plannedSets: 3, distanceM: [30, 40], rpe: [7, 8], restSeconds: 45, loadIncrementKg: 2, tempo: controlled(1, 0, 1, 0) }],
      },
    ],
  },
])

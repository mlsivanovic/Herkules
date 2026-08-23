import { SYS } from './exercises'
import { controlled, withFlatItems, type ProgramTemplate } from './recipe'

export const HOME2_PROGRAM_TAG = 'Program: Home 2-day'
export const HOME2_SOURCE_KEY = 'home-2-day'
export const HOME2_SOURCE_VERSION = 1
export const HOME2_PLAN_NAME = 'Home 2-day'
export const HOME2_PLAN_NOTES =
  'Apartment strength: pull-up bar, TRX, push-up handles, dumbbells capped at 15 kg each. Two full-body days, three sessions a week (Mon/Wed/Fri: A/B/A then B/A/B). ~55–70 min. Do not run A and B on consecutive days.\n\nMost work at RPE 7–8 with RIR 2–3. Last pull-up/chin-up set may reach RIR 2 — do not grind the first sets. Change only one progression lever per week: add reps until every work set hits the top of its range with RIR ≥ 2 → add load (backpack; never a dumbbell between the feet) → increase ROM → slow the eccentric to 3–4 s → pause in the hardest position → switch to the unilateral variant. Bilateral squats and RDLs with 30 kg are usually too light; keep split-stance work.\n\nRest 20–40 s between paired exercises, 90–150 s after the main pair, 60–90 s after the second pair, 45–75 s after the rest. Deload every 5–8 weeks (drop one set from the main pairs or stay at RIR 3). Easy walking on off days; do not skip sessions for it. Add a 4th pull-up round only when all 3 finish with reserve.'

const RULES =
  'Most work at RPE 7–8 with RIR 2–3. Change only one progression lever per week. Add load only after every work set reaches the top of its range with RIR ≥ 2.'

export const HOME2_TEMPLATES: ProgramTemplate[] = withFlatItems([
  {
    slot: 'A',
    name: 'Home A — Quad + Pull-up + Push',
    notes: `${HOME2_PROGRAM_TAG} A\n\nBulgarian split squat, pull-up, feet-elevated push-up, single-leg RDL. ~60 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'About 5 min. Then one easy split-squat set per leg before the first working round.',
        items: [
          { exerciseId: SYS.catCow, plannedSets: 1, durationS: [40, 60], rpe: [3, 4], restSeconds: 10, tempo: controlled(2, 0, 2, 0) },
          { exerciseId: SYS.hipFlexorStretch, plannedSets: 1, durationS: [30, 40], rpe: [3, 4], restSeconds: 10, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Rear knee down, tuck the pelvis, do not crank the lumbar spine.' },
          { exerciseId: SYS.deadHang, plannedSets: 1, durationS: [15, 25], rpe: [4, 5], restSeconds: 20, tempo: controlled(0, 0, 0, 0), notes: 'Pain-free only. Pack the shoulders, then relax into a hang.' },
        ],
      },
      {
        key: 'squat_pull', role: 'strength', format: 'superset', restAfterRoundS: 120,
        notes: 'Split squat → 20–40 s → pull-up → 90–150 s → repeat. This is a strength pair, not a conditioning circuit.',
        items: [
          {
            exerciseId: SYS.bulgarianSplitSquat, plannedSets: 3, reps: [8, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 30, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0),
            notes: 'Dumbbells at the sides. Rear foot on a chair. 3 s down, short pause at the bottom, full depth you can control. Same load both legs. When 3×12 with 2×15 kg is easy at RIR 2, switch to 1.5-rep: down → half up → down → stand = 1 rep.',
          },
          {
            exerciseId: SYS.pullUp, plannedSets: 3, reps: [5, 8], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 1),
            notes: 'Neutral or overhand, whatever the bar allows. 2–3 s lower, pause at the top with the chin over the bar. First sets RIR 2–3; last set may reach RIR 2. Add a backpack, never a dumbbell between the feet. Add a 4th round only when all 3 finish with reserve.',
          },
        ],
      },
      {
        key: 'push_hinge', role: 'assistance', format: 'superset', restAfterRoundS: 75,
        notes: 'Push-up → 20 s → single-leg RDL → 60–90 s → repeat.',
        items: [
          {
            exerciseId: SYS.pushUp, plannedSets: 3, reps: [6, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 20, loadIncrementKg: 2, tempo: controlled(3, 1, 1, 0),
            notes: 'Handles for extra ROM; feet on a chair. Pause just above the handles. Stay in 6–12 — 20 easy reps is conditioning, not the progression. Next: slower tempo, then a backpack. Floor press with 2×15 kg is too light; skip it.',
          },
          {
            exerciseId: SYS.singleLegRdl, plannedSets: 3, reps: [8, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 75, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0),
            notes: 'Both dumbbells if balance allows. Soft knee, hips square, 3 s down and 1 s stretch. Bilateral 30 kg RDL is usually too light — stay on one leg. Log per leg.',
          },
        ],
      },
      {
        key: 'row_raise', role: 'assistance', format: 'superset', restAfterRoundS: 60,
        notes: 'TRX row → 20 s → lateral raise → 45–75 s → repeat.',
        items: [
          {
            exerciseId: SYS.invertedRow, plannedSets: 3, reps: [8, 15], rpe: [7, 8], restSeconds: 20, tempo: controlled(3, 1, 1, 1),
            notes: 'TRX or bar. Chest to the handles, squeeze the shoulder blades, long controlled stretch at the bottom. Feet farther forward = harder. If easy, put the feet on a chair so the body is closer to horizontal.',
          },
          {
            exerciseId: SYS.lateralRaise, plannedSets: 3, reps: [12, 20], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(2, 0, 1, 1),
            notes: 'No swing. Stop near shoulder height. 15 kg is usually too heavy — use a band, bottles, a backpack, or lean-away with a smaller range. One arm at a time is fine for ROM.',
          },
        ],
      },
      {
        key: 'arms_core', role: 'core', format: 'superset', restAfterRoundS: 45,
        notes: 'Triceps → 20 s → body saw → 45–75 s → repeat. Add a 3rd round only when both finish with reserve.',
        items: [
          {
            exerciseId: SYS.overheadTriceps, plannedSets: 2, reps: [10, 15], rpe: [7, 7], restSeconds: 20, loadIncrementKg: 1, tempo: controlled(3, 0, 1, 0),
            notes: 'One dumbbell, both hands, or one arm. Elbows stay close. Do not let the ribs flare.',
          },
          {
            exerciseId: SYS.trxBodySaw, plannedSets: 2, reps: [8, 12], rpe: [7, 7], restSeconds: 45, tempo: controlled(3, 0, 1, 0),
            notes: 'Feet in the straps, plank, saw the body long then pull the shoulders back over the hands. Hips must not sag. If you lack floor space, hollow body hold 3 × 20–40 s instead.',
          },
        ],
      },
    ],
  },
  {
    slot: 'B',
    name: 'Home B — Hinge + Overhead + Pull',
    notes: `${HOME2_PROGRAM_TAG} B\n\nSingle-leg RDL, chin-up, single-arm press, reverse lunge. ~60 min.\n${RULES}`,
    blocks: [
      {
        key: 'warmup', role: 'warmup', format: 'straight',
        notes: 'About 5 min. Then one easy single-leg RDL per side before the first working round.',
        items: [
          { exerciseId: SYS.hipHinge, plannedSets: 1, reps: [8, 8], rpe: [3, 4], restSeconds: 15, tempo: controlled(2, 0, 2, 0), notes: 'Pattern only — no load. Soft knees, bar path close if you imagine a bar.' },
          { exerciseId: SYS.gluteBridge, plannedSets: 2, reps: [10, 12], rpe: [4, 5], restSeconds: 20, tempo: controlled(2, 1, 1, 1) },
          { exerciseId: SYS.externalRotation, plannedSets: 1, reps: [10, 12], rpe: [4, 5], restSeconds: 20, sideMode: 'per_side', tempo: controlled(2, 0, 2, 0), notes: 'Band, elbow pinned to the ribs. Skip if you have no band and do extra dead hangs.' },
        ],
      },
      {
        key: 'hinge_pull', role: 'strength', format: 'superset', restAfterRoundS: 120,
        notes: 'Single-leg RDL → 20–40 s → chin-up → 90–150 s → repeat. Main hinge of the day.',
        items: [
          {
            exerciseId: SYS.singleLegRdl, plannedSets: 3, reps: [8, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 30, sideMode: 'per_leg', loadIncrementKg: 1, tempo: controlled(3, 1, 1, 0),
            notes: 'Both dumbbells. This is the heavy hinge — hips square, standing knee soft, 3 s down. Do not round the back chasing depth. Log per leg.',
          },
          {
            exerciseId: SYS.chinUp, plannedSets: 3, reps: [6, 10], rpe: [7, 8], rir: [2, 3], restSeconds: 120, loadIncrementKg: 2, tempo: controlled(3, 0, 1, 2),
            notes: 'Underhand if the bar allows; if day A was overhand and the bar is only one grip, keep it and use this tempo: 1 s up, 2 s hold, 3 s down. Same backpack loading as pull-ups. RIR 2–3.',
          },
        ],
      },
      {
        key: 'press_lunge', role: 'assistance', format: 'superset', restAfterRoundS: 90,
        notes: 'Overhead press → 20–40 s → reverse lunge → 60–90 s → repeat.',
        items: [
          {
            exerciseId: SYS.dbShoulderPress, plannedSets: 3, reps: [6, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 30, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(2, 0, 1, 0),
            notes: 'Start single-arm if 2×15 kg bilateral already hits 12 at RIR 2. Brace so the ribs stay down; the free hand can be on the hip. When 15 kg single-arm is easy, progress to pike / deficit pike push-up. Z-press is optional if you can sit tall on the floor.',
          },
          {
            exerciseId: SYS.reverseLunge, plannedSets: 3, reps: [8, 12], rpe: [7, 8], rir: [2, 3], restSeconds: 90, sideMode: 'per_leg', loadIncrementKg: 2, tempo: controlled(3, 0, 1, 0),
            notes: 'Dumbbells at the sides. Step back, drop the rear knee, push the front foot. Stay in place. If 2×15 kg is easy, elevate the front foot 5–10 cm. Keep reverse lunges (not another Bulgarian) unless you specifically want more quad overlap with day A.',
          },
        ],
      },
      {
        key: 'push_face', role: 'assistance', format: 'superset', restAfterRoundS: 60,
        notes: 'Push-up → 20 s → TRX face pull → 45–75 s → repeat. Face pull is rear delt / cuff, not a row.',
        items: [
          {
            exerciseId: SYS.pushUp, plannedSets: 3, reps: [6, 12], rpe: [7, 8], restSeconds: 20, loadIncrementKg: 2, tempo: controlled(2, 1, 1, 0),
            notes: 'Feet-elevated or backpack — same family as day A, slightly easier than the A slot is fine. Prefer this over floor press with 2×15 kg. Stop if the shoulders complain; then do fewer reps, not a shallower range.',
          },
          {
            exerciseId: SYS.trxFacePull, plannedSets: 3, reps: [12, 20], rpe: [7, 7], restSeconds: 60, tempo: controlled(2, 0, 1, 1),
            notes: 'Palms in, elbows high, pull to the temples, then a little external rotation so the fists finish beside the head. Control the return. Step the feet forward to make it harder.',
          },
        ],
      },
      {
        key: 'carry', role: 'carry', format: 'straight',
        notes: 'Do the hold before curls so the suitcase is anti-lateral work, not a fried-grip leftover.',
        items: [
          {
            exerciseId: SYS.suitcaseHold, plannedSets: 3, durationS: [30, 45], rpe: [7, 7], restSeconds: 45, sideMode: 'per_side', loadIncrementKg: 1, tempo: controlled(0, 0, 0, 0),
            notes: 'One 15 kg dumbbell at the side. Stand tall, do not lean toward or away from the load. Switch hands after the time. Log hold time, not a walk. Farmer walk is allowed if you have a hallway.',
          },
        ],
      },
      {
        key: 'arms', role: 'assistance', format: 'straight',
        notes: 'After the suitcase hold. Rest 60 s if the grip is still cooked.',
        items: [
          {
            exerciseId: SYS.hammerCurl, plannedSets: 3, reps: [8, 12], rpe: [7, 7], restSeconds: 60, loadIncrementKg: 1, tempo: controlled(3, 0, 2, 0),
            notes: '2 s up, 3 s down. No swing. Thumbs up. Stop the set if the torso starts to rock.',
          },
        ],
      },
    ],
  },
])

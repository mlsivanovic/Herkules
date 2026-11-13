// After Finish, copy heart-rate samples that Health Connect already has for
// this session. Two overlapping watch workouts are left for the import screen.
import { heartRateForFinishedSession } from './healthConnect'
import type { HeartRateSample } from './heartRate'
import { isNativeApp, readHealthHeartRate, readHealthWorkouts } from './herkulesHealth'

export async function attachWatchHeartRate(
  session: { id: string; started_at: string },
  attach: (sessionId: string, samples: readonly HeartRateSample[]) => Promise<boolean>,
): Promise<void> {
  if (!isNativeApp()) return
  const startMs = Date.parse(session.started_at)
  const endMs = Date.now()
  if (!Number.isFinite(startMs) || endMs <= startMs) return
  const [workouts, samples] = await Promise.all([
    readHealthWorkouts(startMs, endMs),
    readHealthHeartRate(startMs, endMs),
  ])
  const chosen = heartRateForFinishedSession({ startMs, endMs }, workouts, samples)
  if (!chosen || chosen.length === 0) return
  await attach(session.id, chosen)
}

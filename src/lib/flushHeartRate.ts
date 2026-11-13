// Writes samples buffered by the Android heart-rate service. The session must
// still be in progress: recordHeartRate ignores a finished workout.
import { recordHeartRate } from './db'
import { drainHeartRateSamples, isNativeApp } from './herkulesHealth'

/** Returns the newest bpm written, if the buffer had any samples. */
export async function flushNativeHeartRate(sessionId: string): Promise<number | null> {
  if (!isNativeApp()) return null
  const samples = await drainHeartRateSamples()
  let latest: number | null = null
  for (const sample of samples) {
    await recordHeartRate(sessionId, sample.at, sample.bpm)
    latest = sample.bpm
  }
  return latest
}

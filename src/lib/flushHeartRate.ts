// Writes samples buffered by the Android heart-rate service. The session must
// still be in progress: recordHeartRate ignores a finished workout.
import { recordHeartRate } from './db'
import { drainHeartRateSamples, isNativeApp, type NativeHeartRateState } from './herkulesHealth'

export interface FlushResult {
  /** Newest bpm written, if the buffer had any samples. */
  latest: number | null
  state: NativeHeartRateState
}

// One flush at a time. Finish awaits the polling flush that is already writing,
// so no drained sample lands after the session is closed.
let queue: Promise<unknown> = Promise.resolve()

export function flushNativeHeartRate(sessionId: string): Promise<FlushResult> {
  const run = queue.then(async (): Promise<FlushResult> => {
    if (!isNativeApp()) return { latest: null, state: 'idle' }
    const { samples, state } = await drainHeartRateSamples()
    let latest: number | null = null
    for (const sample of samples) {
      await recordHeartRate(sessionId, sample.at, sample.bpm)
      latest = sample.bpm
    }
    return { latest, state }
  })
  queue = run.catch(() => undefined)
  return run
}

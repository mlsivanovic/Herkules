export interface HeartRateSample {
  at: number
  bpm: number
}

export function summarizeHeartRate(samples: readonly HeartRateSample[]) {
  if (samples.length === 0) return null
  let sum = 0
  let peak = 0
  for (const { bpm } of samples) {
    sum += bpm
    peak = Math.max(peak, bpm)
  }
  return { average: Math.round(sum / samples.length), peak }
}

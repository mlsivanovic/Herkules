// Audible and haptic cues for timers. Device-local preferences (not synced) —
// sound and vibration are per-device concerns. Everything fails silently:
// no cue is ever worth crashing a workout for.
const SOUND_KEY = 'herkules:cue-sound'
const VIBRATION_KEY = 'herkules:cue-vibration'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

function writeFlag(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? 'on' : 'off')
  } catch {
    /* private mode — cue settings just won't persist */
  }
}

export function soundEnabled(): boolean {
  return readFlag(SOUND_KEY)
}

export function setSoundEnabled(enabled: boolean): void {
  writeFlag(SOUND_KEY, enabled)
}

export function vibrationEnabled(): boolean {
  return readFlag(VIBRATION_KEY)
}

export function setVibrationEnabled(enabled: boolean): void {
  writeFlag(VIBRATION_KEY, enabled)
}

let audioContext: AudioContext | null = null

/** Short double beep; creates/resumes the AudioContext lazily. */
export function playDoubleBeep(): void {
  if (!soundEnabled()) return
  try {
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
    const start = audioContext.currentTime + 0.01
    for (const offset of [0, 0.18]) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = 660
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.1)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.12)
    }
  } catch {
    /* autoplay policies, missing AudioContext — stay quiet */
  }
}

/** Haptic double pulse where the Vibration API exists (mostly Android). */
export function vibrateCue(): void {
  if (!vibrationEnabled()) return
  try {
    navigator.vibrate?.([140, 90, 140])
  } catch {
    /* never fatal */
  }
}

/** The "rest is over / interval changed" cue: sound and/or haptics. */
export function timerCue(): void {
  playDoubleBeep()
  vibrateCue()
}

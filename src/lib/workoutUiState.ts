// Local workout UI preferences. Values live with the user and session.
// They are not workout data and are cleared on logout or session delete.

import type { SetDraftInput } from './validation'

const FOCUS_PREFIX = 'herkules:workout-focus:'
const DRAFT_PREFIX = 'herkules:set-drafts:'

export interface WorkoutFocusPref {
  exerciseId: string
  setId: string
}

const memory = new Map<string, string>()

function readRaw(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage.getItem(key)
    }
  } catch {
    /* private mode */
  }
  return memory.get(key) ?? null
}

function writeRaw(key: string, value: string | null): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
      return
    }
  } catch {
    /* private mode */
  }
  if (value === null) memory.delete(key)
  else memory.set(key, value)
}

function keys(): string[] {
  const found = new Set<string>(memory.keys())
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key) found.add(key)
      }
    }
  } catch {
    /* private mode */
  }
  return [...found]
}

export function focusStorageKey(userId: string, sessionId: string): string {
  return `${FOCUS_PREFIX}${userId}:${sessionId}`
}

export function draftStorageKey(userId: string, sessionId: string): string {
  return `${DRAFT_PREFIX}${userId}:${sessionId}`
}

export function readWorkoutFocus(userId: string, sessionId: string): WorkoutFocusPref | null {
  if (!userId || !sessionId) return null
  const raw = readRaw(focusStorageKey(userId, sessionId))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'exerciseId' in parsed &&
      'setId' in parsed &&
      typeof parsed.exerciseId === 'string' &&
      typeof parsed.setId === 'string'
    ) {
      return { exerciseId: parsed.exerciseId, setId: parsed.setId }
    }
  } catch {
    /* ignore broken prefs */
  }
  return null
}

export function writeWorkoutFocus(userId: string, sessionId: string, focus: WorkoutFocusPref | null): void {
  if (!userId || !sessionId) return
  writeRaw(focusStorageKey(userId, sessionId), focus ? JSON.stringify(focus) : null)
}

export function readSetDrafts(userId: string, sessionId: string): Record<string, SetDraftInput> {
  if (!userId || !sessionId) return {}
  const raw = readRaw(draftStorageKey(userId, sessionId))
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Record<string, SetDraftInput>
  } catch {
    return {}
  }
}

export function writeSetDraft(
  userId: string,
  sessionId: string,
  setId: string,
  draft: SetDraftInput | null,
): void {
  if (!userId || !sessionId || !setId) return
  const all = readSetDrafts(userId, sessionId)
  if (draft === null) delete all[setId]
  else all[setId] = draft
  writeRaw(draftStorageKey(userId, sessionId), JSON.stringify(all))
}

function removeKeys(match: (key: string) => boolean): void {
  for (const key of keys()) {
    if (!key.startsWith(FOCUS_PREFIX) && !key.startsWith(DRAFT_PREFIX)) continue
    if (match(key)) writeRaw(key, null)
  }
}

/** Drop focus and drafts for one session, whichever user stored them. */
export function clearSessionWorkoutUi(sessionId: string): void {
  if (!sessionId) return
  removeKeys((key) => key.endsWith(`:${sessionId}`))
}

/** Drop every workout focus and draft. Used on logout and account switch. */
export function clearAllWorkoutUi(): void {
  removeKeys(() => true)
}

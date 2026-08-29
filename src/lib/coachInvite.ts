// Invite tokens are random 32-byte hex strings. Only the SHA-256 hex digest
// is stored; the raw token lives in the /#/join/<token> URL. The creating
// device also keeps a local copy so the coach can re-copy the link.

const COACH_TOKENS_KEY = 'herkules:invite-tokens'
const PENDING_JOIN_KEY = 'herkules:pending-join-token'
const memory = new Map<string, string>()

export function newInviteToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return bytesToHex(new Uint8Array(digest))
}

export function invitePath(token: string): string {
  return `/join/${token}`
}

export function isJoinPath(path: string | null | undefined): path is string {
  return Boolean(path && /^\/join\/[0-9a-f]{64}$/i.test(path))
}

export function tokenFromJoinPath(path: string): string | null {
  const match = path.match(/^\/join\/([0-9a-f]{64})$/i)
  return match ? match[1] : null
}

export function rememberInviteToken(inviteId: string, token: string): void {
  const next = readTokenMap()
  next[inviteId] = token
  writeTokenMap(next)
}

export function readInviteToken(inviteId: string): string | null {
  return readTokenMap()[inviteId] ?? null
}

export function forgetInviteToken(inviteId: string): void {
  const next = readTokenMap()
  if (!(inviteId in next)) return
  delete next[inviteId]
  writeTokenMap(next)
}

export function rememberPendingJoinToken(token: string): void {
  writeRaw(PENDING_JOIN_KEY, token)
}

export function readPendingJoinToken(): string | null {
  return readRaw(PENDING_JOIN_KEY)
}

export function clearPendingJoinToken(): void {
  removeRaw(PENDING_JOIN_KEY)
}

function readTokenMap(): Record<string, string> {
  const raw = readRaw(COACH_TOKENS_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [id, token] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof token === 'string' && token.length >= 32) out[id] = token
    }
    return out
  } catch {
    return {}
  }
}

function writeTokenMap(map: Record<string, string>): void {
  writeRaw(COACH_TOKENS_KEY, JSON.stringify(map))
}

function readRaw(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
  } catch {
    /* private mode */
  }
  return memory.get(key) ?? null
}

function writeRaw(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
      return
    }
  } catch {
    /* private mode */
  }
  memory.set(key, value)
}

function removeRaw(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
      return
    }
  } catch {
    /* private mode */
  }
  memory.delete(key)
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

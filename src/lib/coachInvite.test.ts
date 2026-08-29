import { describe, expect, it } from 'vitest'
import {
  clearPendingJoinToken,
  forgetInviteToken,
  hashInviteToken,
  invitePath,
  isJoinPath,
  newInviteToken,
  readInviteToken,
  readPendingJoinToken,
  rememberInviteToken,
  rememberPendingJoinToken,
  tokenFromJoinPath,
} from './coachInvite'

describe('invite tokens', () => {
  it('generates 64-char hex tokens', () => {
    const token = newInviteToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(newInviteToken()).not.toBe(token)
  })

  it('hashes a token to 64 hex chars (SHA-256)', async () => {
    const hash = await hashInviteToken('a'.repeat(64))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(await hashInviteToken('a'.repeat(64)))
    expect(hash).not.toBe(await hashInviteToken('b'.repeat(64)))
  })

  it('builds a hash-router join path', () => {
    expect(invitePath('deadbeef')).toBe('/join/deadbeef')
  })

  it('recognizes full-length join paths', () => {
    const token = 'a'.repeat(64)
    expect(isJoinPath(invitePath(token))).toBe(true)
    expect(tokenFromJoinPath(invitePath(token))).toBe(token)
    expect(isJoinPath('/join/short')).toBe(false)
    expect(isJoinPath('/routines')).toBe(false)
  })

  it('remembers coach copy-link tokens and pending join tokens', () => {
    rememberInviteToken('invite-1', 'b'.repeat(64))
    expect(readInviteToken('invite-1')).toBe('b'.repeat(64))
    forgetInviteToken('invite-1')
    expect(readInviteToken('invite-1')).toBeNull()

    rememberPendingJoinToken('c'.repeat(64))
    expect(readPendingJoinToken()).toBe('c'.repeat(64))
    clearPendingJoinToken()
    expect(readPendingJoinToken()).toBeNull()
  })
})

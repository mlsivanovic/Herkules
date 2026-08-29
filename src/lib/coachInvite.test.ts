import { describe, expect, it } from 'vitest'
import { hashInviteToken, invitePath, newInviteToken } from './coachInvite'

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
})

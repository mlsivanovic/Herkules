import { describe, expect, it } from 'vitest'
import { syncBarStatus } from './syncStatus'

const base = { ready: true, syncing: false, pending: 0, syncError: null as string | null }

describe('syncBarStatus', () => {
  it('hides until the store is ready', () => {
    expect(syncBarStatus({ ...base, ready: false })).toBeNull()
  })

  it('shows error ahead of pending work', () => {
    expect(syncBarStatus({ ...base, syncError: 'JWT expired', pending: 3, syncing: true })).toBe(
      'error',
    )
  })

  it('shows pending while flushing or waiting', () => {
    expect(syncBarStatus({ ...base, syncing: true })).toBe('pending')
    expect(syncBarStatus({ ...base, pending: 1 })).toBe('pending')
  })

  it('shows success when idle and clean', () => {
    expect(syncBarStatus(base)).toBe('success')
  })
})

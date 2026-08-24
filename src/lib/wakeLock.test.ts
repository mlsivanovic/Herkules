import { describe, expect, it, vi, afterEach } from 'vitest'
import { isWakeLockSupported, requestScreenWakeLock } from './wakeLock'

describe('wakeLock', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
  })

  it('detects when wakeLock is supported or unsupported', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    })
    expect(isWakeLockSupported()).toBe(false)

    Object.defineProperty(globalThis, 'navigator', {
      value: { wakeLock: { request: vi.fn() } },
      configurable: true,
      writable: true,
    })
    expect(isWakeLockSupported()).toBe(true)
  })

  it('requests screen wake lock successfully', async () => {
    const mockSentinel = { released: false, release: vi.fn().mockResolvedValue(undefined) }
    const requestMock = vi.fn().mockResolvedValue(mockSentinel)

    Object.defineProperty(globalThis, 'navigator', {
      value: { wakeLock: { request: requestMock } },
      configurable: true,
      writable: true,
    })

    const sentinel = await requestScreenWakeLock()
    expect(requestMock).toHaveBeenCalledWith('screen')
    expect(sentinel).toBe(mockSentinel)
  })

  it('fails gracefully when request rejects', async () => {
    const requestMock = vi.fn().mockRejectedValue(new Error('NotAllowedError'))

    Object.defineProperty(globalThis, 'navigator', {
      value: { wakeLock: { request: requestMock } },
      configurable: true,
      writable: true,
    })

    const sentinel = await requestScreenWakeLock()
    expect(sentinel).toBeNull()
  })
})

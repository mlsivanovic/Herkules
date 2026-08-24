import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  isNotificationSupported,
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from './notifications'

describe('notifications', () => {
  const originalNotification = globalThis.Notification

  afterEach(() => {
    Object.defineProperty(globalThis, 'Notification', {
      value: originalNotification,
      configurable: true,
      writable: true,
    })
  })

  it('checks notification support correctly', () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    expect(isNotificationSupported()).toBe(false)
    expect(notificationPermission()).toBe('unsupported')

    const mockNotification = { permission: 'default' as NotificationPermission }
    Object.defineProperty(globalThis, 'Notification', {
      value: mockNotification,
      configurable: true,
      writable: true,
    })
    expect(isNotificationSupported()).toBe(true)
    expect(notificationPermission()).toBe('default')
  })

  it('requests permission and returns boolean', async () => {
    const mockNotification = {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    }
    Object.defineProperty(globalThis, 'Notification', {
      value: mockNotification,
      configurable: true,
      writable: true,
    })

    const granted = await requestNotificationPermission()
    expect(granted).toBe(true)
    expect(mockNotification.requestPermission).toHaveBeenCalled()
  })

  it('shows notification when granted', () => {
    const constructorSpy = vi.fn()
    const mockNotification = class {
      static permission: NotificationPermission = 'granted'
      constructor(title: string, options?: NotificationOptions) {
        constructorSpy(title, options)
      }
    }
    Object.defineProperty(globalThis, 'Notification', {
      value: mockNotification,
      configurable: true,
      writable: true,
    })

    const shown = showNotification('Rest finished', { body: 'Next set ready' })
    expect(shown).toBe(true)
    expect(constructorSpy).toHaveBeenCalledWith('Rest finished', expect.objectContaining({ body: 'Next set ready' }))
  })
})

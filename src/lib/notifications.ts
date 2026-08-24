// Web Notifications helper for rest timer expiration alerts.
// Fails silently if unsupported or permission denied.

export function isNotificationSupported(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.Notification !== 'undefined'
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return globalThis.Notification.permission
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

export function showNotification(title: string, options?: NotificationOptions): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false
  try {
    new Notification(title, {
      icon: './favicon.svg',
      badge: './favicon.svg',
      ...options,
    })
    return true
  } catch {
    return false
  }
}

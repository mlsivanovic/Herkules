// Absolute URL of the web app, for links that leave this device: auth e-mails
// and coach invites. Inside the APK the page origin is https://localhost and
// the base is './', so those links must point at the public site instead.
import { Capacitor } from '@capacitor/core'

export const PUBLIC_APP_URL = 'https://mlsivanovic.github.io/Herkules/'

export function appBaseUrl(
  native: boolean = Capacitor.isNativePlatform(),
  origin: string = typeof window === 'undefined' ? '' : window.location.origin,
  base: string = import.meta.env.BASE_URL,
): string {
  if (native || !origin) return PUBLIC_APP_URL
  return new URL(base, `${origin}/`).href
}

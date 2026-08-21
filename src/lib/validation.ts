// Input validation shared by forms and set editors.
import { t } from './i18n'

export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (value === '') return t('validation.emailRequired')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('validation.emailInvalid')
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return t('validation.passwordMin')
  return null
}

export function validateRequiredName(name: string, label: string): string | null {
  const value = name.trim()
  if (value === '') return t('validation.required', { label })
  if (value.length > 120) return t('validation.maxLen', { label })
  return null
}

/** Parse a non-negative number from user input; null when invalid/empty. */
export function parseNonNegative(text: string): number | null {
  const value = text.trim()
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function validateHttpsUrl(url: string): string | null {
  const value = url.trim()
  if (value === '') return null
  if (!/^https:\/\/\S+\.\S+/.test(value)) return t('validation.https')
  return null
}

export function validateRpe(rpe: number | null): string | null {
  if (rpe === null) return null
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return t('validation.rpe')
  return null
}

/** mm:ss or h:mm:ss input → seconds; null when malformed. */
export function parseDurationInput(text: string): number | null {
  const value = text.trim()
  if (value === '') return null
  if (/^\d+$/.test(value)) return Number(value)
  const parts = value.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d{1,5}$/.test(p))) return null
  const [h, m, s] = parts.length === 3 ? parts : ['0', ...parts]
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}

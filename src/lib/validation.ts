// Input validation shared by forms and set editors.

export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (value === '') return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}

export function validateRequiredName(name: string, label: string): string | null {
  const value = name.trim()
  if (value === '') return `${label} is required.`
  if (value.length > 120) return `${label} must be at most 120 characters.`
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
  if (!/^https:\/\/\S+\.\S+/.test(value)) return 'Enter a valid https:// link.'
  return null
}

export function validateRpe(rpe: number | null): string | null {
  if (rpe === null) return null
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return 'RPE must be between 1 and 10.'
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

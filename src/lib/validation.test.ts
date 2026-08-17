import { describe, expect, it } from 'vitest'
import {
  parseDurationInput,
  parseNonNegative,
  validateEmail,
  validateHttpsUrl,
  validatePassword,
  validateRpe,
} from './validation'

describe('auth field validation', () => {
  it('accepts valid emails and rejects malformed ones', () => {
    expect(validateEmail('user@example.com')).toBeNull()
    expect(validateEmail('  user@example.com  ')).toBeNull()
    expect(validateEmail('')).toBeTruthy()
    expect(validateEmail('nope')).toBeTruthy()
    expect(validateEmail('a@b')).toBeTruthy()
  })

  it('requires 8+ character passwords', () => {
    expect(validatePassword('short')).toBeTruthy()
    expect(validatePassword('12345678')).toBeNull()
  })
})

describe('numeric parsing', () => {
  it('parses non-negative numbers', () => {
    expect(parseNonNegative('82.5')).toBe(82.5)
    expect(parseNonNegative(' 100 ')).toBe(100)
    expect(parseNonNegative('')).toBeNull()
    expect(parseNonNegative('-5')).toBeNull()
    expect(parseNonNegative('abc')).toBeNull()
  })

  it('validates RPE 1–10', () => {
    expect(validateRpe(null)).toBeNull()
    expect(validateRpe(7)).toBeNull()
    expect(validateRpe(0)).toBeTruthy()
    expect(validateRpe(11)).toBeTruthy()
    expect(validateRpe(7.5)).toBeTruthy()
  })
})

describe('optional https link', () => {
  it('accepts empty, rejects non-https and garbage', () => {
    expect(validateHttpsUrl('')).toBeNull()
    expect(validateHttpsUrl('https://example.com/how-to')).toBeNull()
    expect(validateHttpsUrl('http://example.com')).toBeTruthy()
    expect(validateHttpsUrl('example.com')).toBeTruthy()
  })
})

describe('duration input parsing', () => {
  it('accepts plain seconds, m:ss and h:mm:ss', () => {
    expect(parseDurationInput('90')).toBe(90)
    expect(parseDurationInput('1:30')).toBe(90)
    expect(parseDurationInput('1:01:05')).toBe(3665)
  })

  it('rejects malformed input', () => {
    expect(parseDurationInput('')).toBeNull()
    expect(parseDurationInput('1:2:3:4')).toBeNull()
    expect(parseDurationInput('a:b')).toBeNull()
    expect(parseDurationInput('-1:30')).toBeNull()
  })
})

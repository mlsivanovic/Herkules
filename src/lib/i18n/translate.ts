import { en, type Messages } from './en'
import { sr } from './sr'
import { currentLocale, type Locale } from './locale'

export type Vars = Record<string, string | number>

type Join<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`

type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<Prefix, K>
    : T[K] extends Record<string, unknown>
      ? DotPaths<T[K], Join<Prefix, K>>
      : never
}[keyof T & string]

export type MessageKey = DotPaths<Messages>

const DICTS: Record<Locale, Messages> = { en, sr }

function lookup(dict: Messages, path: string): string | undefined {
  let cursor: unknown = dict
  for (const part of path.split('.')) {
    if (typeof cursor !== 'object' || cursor === null || !(part in cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return typeof cursor === 'string' ? cursor : undefined
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`,
  )
}

export function t(key: MessageKey, vars?: Vars, locale: Locale = currentLocale()): string {
  const value = lookup(DICTS[locale], key) ?? lookup(en, key) ?? key
  return interpolate(value, vars)
}

/** English plural: 1 → one, else other. Serbian: 1/21… → one, 2–4/22–24… → few, else other. */
export function pluralForm(count: number, locale: Locale = currentLocale()): 'one' | 'few' | 'other' {
  const n = Math.abs(Math.trunc(count))
  if (locale === 'en') return n === 1 ? 'one' : 'other'
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'one'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
  return 'other'
}

export function pickPlural(count: number, one: string, other: string, few = other): string {
  const form = pluralForm(count)
  if (form === 'one') return one
  if (form === 'few') return few
  return other
}

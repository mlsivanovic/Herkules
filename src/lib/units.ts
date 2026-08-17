// Unit conversion — canonical storage is kg / meters / seconds.
// Conversion is a display concern only.
import type { UnitSystem } from '../types/db'

export const LB_PER_KG = 2.2046226218
export const M_PER_KM = 1000
export const M_PER_MI = 1609.344

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG
}

export function kmToM(km: number): number {
  return Math.round(km * M_PER_KM)
}

export function mToKm(m: number): number {
  return m / M_PER_KM
}

export function miToM(mi: number): number {
  return Math.round(mi * M_PER_MI)
}

export function mToMi(m: number): number {
  return m / M_PER_MI
}

function trimDecimals(value: number, decimals: number): string {
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  return rounded.toFixed(decimals).replace(/\.?0+$/, '')
}

/** Display weight (stored kg) in the user's system, e.g. "82.5 kg" / "181.9 lb". */
export function formatWeight(weightKg: number, units: UnitSystem): string {
  if (units === 'imperial') return `${trimDecimals(kgToLb(weightKg), 1)} lb`
  return `${trimDecimals(weightKg, 2)} kg`
}

/** Display distance (stored m) in the user's system, e.g. "5.02 km" / "3.12 mi". */
export function formatDistance(distanceM: number, units: UnitSystem): string {
  if (units === 'imperial') return `${trimDecimals(mToMi(distanceM), 2)} mi`
  return `${trimDecimals(mToKm(distanceM), 2)} km`
}

/** Display duration (stored s) as h:mm:ss or m:ss. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** Convert a value typed in the display unit back to canonical kg (2 decimals). */
export function weightToKg(displayValue: number, units: UnitSystem): number {
  const kg = units === 'imperial' ? lbToKg(displayValue) : displayValue
  return Math.round(kg * 100) / 100
}

/** Canonical kg rendered as a plain number for editable inputs. */
export function weightForInput(weightKg: number | null, units: UnitSystem): string {
  if (weightKg === null) return ''
  const value = units === 'imperial' ? kgToLb(weightKg) : weightKg
  return trimDecimals(value, units === 'imperial' ? 1 : 2)
}

/** Convert a distance typed in the display unit back to canonical meters. */
export function distanceToM(displayValue: number, units: UnitSystem): number {
  return units === 'imperial' ? miToM(displayValue) : kmToM(displayValue)
}

/** Canonical meters rendered as a plain number for editable inputs. */
export function distanceForInput(distanceM: number | null, units: UnitSystem): string {
  if (distanceM === null) return ''
  const value = units === 'imperial' ? mToMi(distanceM) : mToKm(distanceM)
  return trimDecimals(value, 2)
}

/** Distance unit label for inputs. */
export function distanceUnitLabel(units: UnitSystem): string {
  return units === 'imperial' ? 'mi' : 'km'
}

/** Weight unit label for inputs. */
export function weightUnitLabel(units: UnitSystem): string {
  return units === 'imperial' ? 'lb' : 'kg'
}

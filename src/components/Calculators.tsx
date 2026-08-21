// Live-workout calculators: barbell plate math and a warm-up ramp generator.
import { useMemo, useState } from 'react'
import type { UnitSystem } from '../types/db'
import { Modal } from './ui'
import { barOptionsFor, denominationsFor, platesForTarget } from '../lib/plates'
import { warmupSets } from '../lib/warmup'
import { formatWeight, weightToKg, weightUnitLabel } from '../lib/units'
import { parseNonNegative } from '../lib/validation'
import { useT } from '../lib/i18n'

export function PlateCalculatorModal({
  units,
  initialKg,
  onClose,
}: {
  units: UnitSystem
  /** prefill in canonical kg (last logged / target weight), if any */
  initialKg: number | null
  onClose(): void
}) {
  const { t } = useT()
  const bars = barOptionsFor(units)
  const [target, setTarget] = useState('')
  const [barWeight, setBarWeight] = useState(bars[0].weight)

  const targetValue = parseNonNegative(target)
  const result = useMemo(() => {
    if (targetValue === null || targetValue === 0) return null
    return platesForTarget(targetValue, barWeight, denominationsFor(units))
  }, [targetValue, barWeight, units])

  const loadedPerSide = result?.perSide.reduce((sum, p) => sum + p.weight * p.count, 0) ?? 0

  return (
    <Modal title={t('plates.title')} onClose={onClose}>
      <div className="field">
        <label htmlFor="plate-target">{t('plates.target', { unit: weightUnitLabel(units) })}</label>
        <input
          id="plate-target"
          className="input"
          type="text"
          inputMode="decimal"
          placeholder={initialKg !== null ? formatWeight(initialKg, units) : '100'}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          autoFocus
        />
        {initialKg !== null && target === '' ? (
          <small className="muted">{t('plates.lastTime', { value: formatWeight(initialKg, units) })}</small>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="plate-bar">{t('plates.bar')}</label>
        <select
          id="plate-bar"
          className="input"
          value={barWeight}
          onChange={(e) => setBarWeight(Number(e.target.value))}
        >
          {bars.map((bar) => (
            <option key={bar.weight} value={bar.weight}>
              {bar.label}
            </option>
          ))}
        </select>
      </div>

      {result?.belowBar ? (
        <p className="field-error" role="alert">
          {t('plates.belowBar')}
        </p>
      ) : null}

      {result && !result.belowBar ? (
        <div className="calc-result">
          <p style={{ margin: 0 }}>
            <strong>{t('plates.perSide')}</strong>{' '}
            {result.perSide.length === 0 ? (
              <span className="muted">{t('plates.emptyBar')}</span>
            ) : (
              result.perSide.map((p) => `${p.weight} ×${p.count}`).join('  +  ')
            )}
          </p>
          {result.remainder > 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Closest loadable:{' '}
              {Math.round((barWeight + 2 * loadedPerSide) * 100) / 100} {weightUnitLabel(units)} (
              {result.remainder} {weightUnitLabel(units)} per side short)
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}

export function WarmupModal({
  units,
  initialKg,
  onAdd,
  onClose,
}: {
  units: UnitSystem
  initialKg: number | null
  onAdd(sets: { weightKg: number; reps: number }[]): void
  onClose(): void
}) {
  const { t } = useT()
  const bars = barOptionsFor(units)
  const [working, setWorking] = useState('')
  const [barWeight, setBarWeight] = useState(bars[0].weight)

  const workingValue = parseNonNegative(working)
  const ramp = useMemo(() => {
    if (workingValue === null || workingValue === 0) return []
    return warmupSets(workingValue, units, barWeight)
  }, [workingValue, units, barWeight])

  return (
    <Modal title="Warm-up sets" onClose={onClose}>
      <div className="field">
        <label htmlFor="warmup-working">Working weight ({weightUnitLabel(units)})</label>
        <input
          id="warmup-working"
          className="input"
          type="text"
          inputMode="decimal"
          placeholder={initialKg !== null ? formatWeight(initialKg, units) : '100'}
          value={working}
          onChange={(e) => setWorking(e.target.value)}
          autoFocus
        />
        {initialKg !== null && working === '' ? (
          <small className="muted">{t('plates.lastTime', { value: formatWeight(initialKg, units) })}</small>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="warmup-bar">Bar</label>
        <select
          id="warmup-bar"
          className="input"
          value={barWeight}
          onChange={(e) => setBarWeight(Number(e.target.value))}
        >
          {bars.map((bar) => (
            <option key={bar.weight} value={bar.weight}>
              {bar.label}
            </option>
          ))}
        </select>
      </div>

      {ramp.length > 0 ? (
        <div className="calc-result">
          {ramp.map((set) => (
            <p key={set.percent} style={{ margin: 0 }}>
              <strong>{set.weight}</strong> {weightUnitLabel(units)} × {set.reps} reps{' '}
              <small className="muted">({Math.round(set.percent * 100)}%)</small>
            </p>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Enter a working weight to generate a 40 / 60 / 80 % ramp.
        </p>
      )}

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={ramp.length === 0}
        onClick={() =>
          onAdd(ramp.map((set) => ({ weightKg: weightToKg(set.weight, units), reps: set.reps })))
        }
      >
        Add {ramp.length} warm-up set{ramp.length === 1 ? '' : 's'}
      </button>
    </Modal>
  )
}

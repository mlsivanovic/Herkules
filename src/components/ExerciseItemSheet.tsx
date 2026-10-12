// Bottom-sheet editor for one routine exercise: sets, targets, rest,
// role, alternative, grouping, notes and advanced params.
import { useState } from 'react'
import type { ExerciseRow, UnitSystem } from '../types/db'
import type { TemplateItemInput } from '../lib/store'
import { BottomSheet, NotesDisclosure } from './ui'
import { MEASUREMENT_LABELS } from './ExercisePicker'
import { blockRoles, normalizeBlockRole } from '../lib/blockRole'
import { categoryLabel, useT } from '../lib/i18n'
import {
  distanceForInput,
  distanceToM,
  distanceUnitLabel,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import { IconChevronDown, IconTrash } from './Icons'

function structuredTempo(
  item: TemplateItemInput,
  patch: Partial<TemplateItemInput>,
): string | null {
  const next = { ...item, ...patch }
  const hasPhase = [
    next.tempo_eccentric,
    next.tempo_stretch_pause,
    next.tempo_concentric,
    next.tempo_contracted_pause,
  ].some((value) => value != null)
  if (!hasPhase) return next.tempo ?? null
  return [
    next.tempo_eccentric ?? 0,
    next.tempo_stretch_pause ?? 0,
    next.tempo_intent === 'explosive' ? 'X' : next.tempo_concentric ?? 0,
    next.tempo_contracted_pause ?? 0,
  ].join('-')
}

function hasAdvancedParams(item: TemplateItemInput): boolean {
  return (
    item.target_rpe_min != null ||
    item.target_rpe_max != null ||
    item.target_rir_min != null ||
    item.target_rir_max != null ||
    item.load_increment_kg != null ||
    (item.side_mode != null && item.side_mode !== 'bilateral') ||
    (item.directions != null && item.directions !== 1) ||
    item.tempo_eccentric != null ||
    item.tempo_stretch_pause != null ||
    item.tempo_concentric != null ||
    item.tempo_contracted_pause != null ||
    (item.tempo_intent != null && item.tempo_intent !== 'controlled')
  )
}

export function ExerciseItemSheet({
  item,
  name,
  summary,
  exercise,
  backupName,
  partners,
  blockBadge,
  blockFormat,
  inBlock,
  units,
  videoHref,
  bodyweightLoad,
  onPatch,
  onToggleSuperset,
  onPickBackup,
  onClearBackup,
  onRemove,
  onClose,
}: {
  item: TemplateItemInput
  name: string
  summary: string
  exercise: ExerciseRow | undefined
  backupName: string | null
  partners: string[]
  blockBadge: string | null
  blockFormat: string
  inBlock: boolean
  units: UnitSystem
  videoHref: string | null
  bodyweightLoad: boolean
  onPatch(patch: Partial<TemplateItemInput>): void
  onToggleSuperset(): void
  onPickBackup(): void
  onClearBackup(): void
  onRemove(): void
  onClose(): void
}) {
  const { t } = useT()
  const [notesOpen, setNotesOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const measurement = exercise?.measurement ?? 'weight_reps'
  const role = normalizeBlockRole(item.block_role)
  const guideHref =
    exercise?.source_url && exercise.source_url !== videoHref ? exercise.source_url : null

  return (
    <BottomSheet title={name} description={summary} onClose={onClose}>
      {videoHref || guideHref ? (
        <div className="sheet-links">
          {videoHref ? (
            <a
              href={videoHref}
              target="_blank"
              rel="noreferrer noopener"
              className="form-link-icon"
              aria-label={t('editor.watchForm', { name })}
              title={t('editor.watchForm', { name })}
            >
              <span aria-hidden="true">▶️</span>
            </a>
          ) : null}
          {guideHref ? (
            <a
              href={guideHref}
              target="_blank"
              rel="noreferrer noopener"
              className="form-link-icon"
              aria-label={t('editor.openGuide', { name })}
              title={t('editor.openGuide', { name })}
            >
              <span aria-hidden="true">📖</span>
            </a>
          ) : null}
        </div>
      ) : null}
      {partners.length > 0 ? (
        <div className="exercise-superset">
          <span className="badge badge--in-progress">{t('blockFormat.superset')}</span>
          <span className="exercise-superset__with">
            {t('editor.withPartners', { names: partners.join(', ') })}
          </span>
        </div>
      ) : null}
      {blockBadge ? (
        <div className="exercise-superset">
          <span className="badge badge--neutral">{blockBadge}</span>
          <span className="exercise-superset__with">{blockFormat}</span>
        </div>
      ) : null}

      <section className="sheet-section" aria-label={t('editor.mainSettings')}>
        <h3 className="sheet-section__title">{t('editor.mainSettings')}</h3>
        <div className="routine-grid">
          <label className="field">
            <span>{t('editor.sets')}</span>
            <input
              className="input input--cell"
              type="number"
              min={1}
              max={30}
              value={item.planned_sets}
              onChange={(e) =>
                onPatch({
                  planned_sets: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                })
              }
            />
          </label>

          {measurement === 'weight_reps' ? (
            <>
              <label className="field">
                <span>
                  {bodyweightLoad
                    ? t('editor.addedLoad', { unit: weightUnitLabel(units) })
                    : t('editor.targetWeight', { unit: weightUnitLabel(units) })}
                </span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  step="0.5"
                  value={weightForInput(item.target_weight_kg, units)}
                  placeholder={bodyweightLoad ? t('set.bodyweight') : undefined}
                  onChange={(e) =>
                    onPatch({
                      target_weight_kg:
                        e.target.value === '' ? null : weightToKg(Number(e.target.value), units),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('editor.minReps')}</span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  value={item.target_reps_min ?? item.target_reps ?? ''}
                  onChange={(e) => onPatch({ target_reps_min: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>{t('editor.maxReps')}</span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  value={item.target_reps_max ?? item.target_reps ?? ''}
                  onChange={(e) =>
                    onPatch({
                      target_reps: e.target.value === '' ? null : Number(e.target.value),
                      target_reps_max: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </>
          ) : null}

          {measurement === 'reps' ? (
            <>
              <label className="field">
                <span>{t('editor.minReps')}</span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  value={item.target_reps_min ?? item.target_reps ?? ''}
                  onChange={(e) =>
                    onPatch({
                      target_reps_min: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('editor.maxReps')}</span>
                <input className="input input--cell" type="number" min={0} value={item.target_reps_max ?? item.target_reps ?? ''} onChange={(e) => onPatch({ target_reps: e.target.value === '' ? null : Number(e.target.value), target_reps_max: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            </>
          ) : null}

          {measurement === 'weight_distance' ? (
            <>
              <label className="field">
                <span>{t('editor.targetWeight', { unit: weightUnitLabel(units) })}</span>
                <input className="input input--cell" type="number" min={0} step="0.5" value={weightForInput(item.target_weight_kg, units)} onChange={(e) => onPatch({ target_weight_kg: e.target.value === '' ? null : weightToKg(Number(e.target.value), units) })} />
              </label>
              <label className="field">
                <span>{t('editor.minDistance', { unit: distanceUnitLabel(units) })}</span>
                <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_min_m ?? item.target_distance_m, units)} onChange={(e) => onPatch({ target_distance_min_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
              </label>
              <label className="field">
                <span>{t('editor.maxDistance', { unit: distanceUnitLabel(units) })}</span>
                <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_max_m ?? item.target_distance_m, units)} onChange={(e) => onPatch({ target_distance_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units), target_distance_max_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
              </label>
            </>
          ) : null}

          {measurement === 'weight_duration' ? (
            <>
              <label className="field">
                <span>{t('editor.targetWeight', { unit: weightUnitLabel(units) })}</span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  step="0.5"
                  value={weightForInput(item.target_weight_kg, units)}
                  onChange={(e) =>
                    onPatch({
                      target_weight_kg:
                        e.target.value === '' ? null : weightToKg(Number(e.target.value), units),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('editor.minHold')}</span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  value={item.target_duration_min_s ?? item.target_duration_s ?? ''}
                  onChange={(e) =>
                    onPatch({
                      target_duration_min_s: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('editor.maxHold')}</span>
                <input className="input input--cell" type="number" min={0} value={item.target_duration_max_s ?? item.target_duration_s ?? ''} onChange={(e) => onPatch({ target_duration_s: e.target.value === '' ? null : Number(e.target.value), target_duration_max_s: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            </>
          ) : null}

          {measurement === 'duration' || measurement === 'distance_duration' ? (
            <>
              <label className="field">
                <span>{t('editor.minSeconds')}</span>
                <input className="input input--cell" type="number" min={0} value={item.target_duration_min_s ?? item.target_duration_s ?? ''} onChange={(e) => onPatch({ target_duration_min_s: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>{t('editor.maxSeconds')}</span>
                <input className="input input--cell" type="number" min={0} value={item.target_duration_max_s ?? item.target_duration_s ?? ''} onChange={(e) => onPatch({ target_duration_s: e.target.value === '' ? null : Number(e.target.value), target_duration_max_s: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            </>
          ) : null}

          {measurement === 'distance_duration' ? (
            <>
              <label className="field">
                <span>{t('editor.minDistance', { unit: distanceUnitLabel(units) })}</span>
                <input
                  className="input input--cell"
                  type="number"
                  min={0}
                  step="0.1"
                  value={distanceForInput(item.target_distance_min_m ?? item.target_distance_m, units)}
                  onChange={(e) =>
                    onPatch({
                      target_distance_min_m:
                        e.target.value === '' ? null : distanceToM(Number(e.target.value), units),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('editor.maxDistance', { unit: distanceUnitLabel(units) })}</span>
                <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_max_m ?? item.target_distance_m, units)} onChange={(e) => onPatch({ target_distance_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units), target_distance_max_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
              </label>
            </>
          ) : null}

          <label className="field">
            <span>{t('editor.tempo')}</span>
            <input
              className="input input--cell"
              type="text"
              inputMode="text"
              placeholder="3-0-1"
              maxLength={16}
              value={item.tempo ?? ''}
              onChange={(e) =>
                onPatch({
                  tempo: e.target.value.trim() === '' ? null : e.target.value.trim(),
                })
              }
            />
          </label>

          <label className="field">
            <span>{t('editor.rest')}</span>
            <input
              className="input input--cell"
              type="number"
              min={0}
              max={3600}
              value={item.rest_seconds ?? ''}
              onChange={(e) =>
                onPatch({
                  rest_seconds: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <small className="muted">
          {exercise ? categoryLabel(exercise.category) : ''} · {MEASUREMENT_LABELS(measurement)}
        </small>
      </section>

      <section className="sheet-section" aria-label={t('editor.setupSettings')}>
        <h3 className="sheet-section__title">{t('editor.setupSettings')}</h3>
        <div className="row row--wrap" role="group" aria-label={t('editor.roleFor', { name })}>
          {blockRoles().map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`btn btn--small role-chip role-chip--${chip.value}${role === chip.value ? ' is-selected' : ''}`}
              aria-pressed={role === chip.value}
              onClick={() => onPatch({ block_role: chip.value })}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <label className="field field--check">
          <input
            type="checkbox"
            checked={item.is_warmup === true}
            onChange={(event) => onPatch({ is_warmup: event.target.checked })}
          />
          <span>{t('editor.warmupExercise')}</span>
        </label>

        <div className="routine-backup">
          <div>
            <strong>{t('editor.backupExercise')}</strong>
            <small className="muted">
              {backupName ?? t('editor.noBackupExercise')}
            </small>
          </div>
          <div className="row row--wrap">
            <button type="button" className="btn btn--small" onClick={onPickBackup}>
              {backupName ? t('editor.changeBackupExercise') : t('editor.addBackupExercise')}
            </button>
            {backupName ? (
              <button
                type="button"
                className="btn btn--small btn--ghost"
                aria-label={t('editor.removeBackupNamed', { name: backupName })}
                onClick={onClearBackup}
              >
                {t('common.remove')}
              </button>
            ) : null}
          </div>
        </div>

        {inBlock ? (
          <small className="muted">{t('editor.groupingV2')}</small>
        ) : (
          <button
            type="button"
            className={`btn btn--small ${item.superset_group ? 'btn--accent' : ''}`}
            aria-pressed={Boolean(item.superset_group)}
            onClick={onToggleSuperset}
          >
            {item.superset_group ? t('editor.inSuperset') : t('editor.supersetNext')}
          </button>
        )}

        <NotesDisclosure
          label={item.notes ? t('editor.notesItem') : t('editor.addNotes')}
          preview={item.notes}
          open={notesOpen}
          filled={Boolean(item.notes)}
          onToggle={() => setNotesOpen((open) => !open)}
          panelId="routine-sheet-notes"
        >
          <label className="field">
            <span className="visually-hidden">{t('editor.notesItem')}</span>
            <textarea
              className="input"
              rows={2}
              placeholder={t('editor.notesPlaceholder')}
              value={item.notes ?? ''}
              onChange={(e) =>
                onPatch({ notes: e.target.value === '' ? null : e.target.value })
              }
            />
          </label>
        </NotesDisclosure>

        <div className={`advanced-block${hasAdvancedParams(item) ? ' advanced-block--filled' : ''}`}>
          <button
            type="button"
            className="advanced-toggle"
            aria-expanded={advancedOpen}
            aria-controls="routine-sheet-advanced"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span className="advanced-toggle__label">
              {advancedOpen ? t('editor.hideAdvanced') : t('editor.showAdvanced')}
            </span>
            <span className="muted advanced-toggle__hint">{t('editor.advancedHint')}</span>
            <IconChevronDown className="advanced-toggle__chevron" width={14} height={14} />
          </button>
          {advancedOpen ? (
            <div className="routine-grid" id="routine-sheet-advanced">
              {([
                ['tempo_eccentric', 'editor.eccentric'],
                ['tempo_stretch_pause', 'editor.stretchPause'],
                ['tempo_concentric', 'editor.concentric'],
                ['tempo_contracted_pause', 'editor.contractedPause'],
              ] as const).map(([field, labelKey]) => (
                <label className="field" key={field}>
                  <span>{t(labelKey)}</span>
                  <input
                    className="input input--cell"
                    type="number"
                    min={0}
                    step="0.5"
                    value={item[field] ?? ''}
                    onChange={(e) => {
                      const patch = { [field]: e.target.value === '' ? null : Number(e.target.value) }
                      onPatch({ ...patch, tempo: structuredTempo(item, patch) })
                    }}
                  />
                </label>
              ))}
              <label className="field">
                <span>{t('editor.sideMode')}</span>
                <select className="input input--cell" value={item.side_mode ?? 'bilateral'} onChange={(e) => onPatch({ side_mode: e.target.value as NonNullable<TemplateItemInput['side_mode']> })}>
                  <option value="bilateral">{t('editor.bilateral')}</option>
                  <option value="per_side">{t('editor.perSide')}</option>
                  <option value="per_leg">{t('editor.perLeg')}</option>
                </select>
              </label>
              <label className="field">
                <span>{t('editor.directions')}</span>
                <input className="input input--cell" type="number" min={1} max={4} value={item.directions ?? 1} onChange={(e) => onPatch({ directions: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })} />
              </label>
              <label className="field">
                <span>{t('editor.rpeMin')}</span>
                <input className="input input--cell" type="number" min={1} max={10} step="0.5" value={item.target_rpe_min ?? ''} onChange={(e) => onPatch({ target_rpe_min: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>{t('editor.rpeMax')}</span>
                <input className="input input--cell" type="number" min={1} max={10} step="0.5" value={item.target_rpe_max ?? ''} onChange={(e) => onPatch({ target_rpe_max: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>{t('editor.rirMin')}</span>
                <input className="input input--cell" type="number" min={0} max={10} step="0.5" value={item.target_rir_min ?? ''} onChange={(e) => onPatch({ target_rir_min: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>{t('editor.rirMax')}</span>
                <input className="input input--cell" type="number" min={0} max={10} step="0.5" value={item.target_rir_max ?? ''} onChange={(e) => onPatch({ target_rir_max: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>{t('editor.loadIncrement')}</span>
                <input className="input input--cell" type="number" min={0} step="0.5" value={item.load_increment_kg ?? ''} onChange={(e) => onPatch({ load_increment_kg: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>{t('editor.tempoIntent')}</span>
                <select className="input input--cell" value={item.tempo_intent ?? 'controlled'} onChange={(e) => {
                  const patch = { tempo_intent: e.target.value as 'controlled' | 'explosive' }
                  onPatch({ ...patch, tempo: structuredTempo(item, patch) })
                }}>
                  <option value="controlled">{t('editor.controlled')}</option>
                  <option value="explosive">{t('editor.explosive')}</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <section className="sheet-section" aria-label={t('editor.removeExercise')}>
        <button type="button" className="btn btn--danger btn--block" onClick={onRemove}>
          <IconTrash width={16} height={16} /> {t('editor.removeExercise')}
        </button>
      </section>
    </BottomSheet>
  )
}

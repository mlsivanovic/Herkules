// Exercise picker modal: search + category filter over the local catalog.
import { useMemo, useState } from 'react'
import type { ExerciseCategory, ExerciseRow } from '../types/db'
import { useStore } from '../lib/store'
import {
  categoryLabel,
  displayExerciseName,
  exerciseMatchesQuery,
  t,
  useT,
  type MessageKey,
} from '../lib/i18n'
import { Modal } from './ui'

export function MEASUREMENT_LABELS(measurement: ExerciseRow['measurement']): string {
  const key: MessageKey =
    measurement === 'weight_reps'
      ? 'measurement.weight_reps'
      : measurement === 'reps'
        ? 'measurement.reps'
        : measurement === 'duration'
          ? 'measurement.duration'
          : measurement === 'distance_duration'
            ? 'measurement.distance_duration'
            : measurement === 'weight_duration'
              ? 'measurement.weight_duration'
              : measurement === 'weight_distance'
                ? 'measurement.weight_distance'
                : 'measurement.reps'
  return t(key)
}

export function ExercisePicker({
  title,
  onSelect,
  onClose,
}: {
  title?: string
  onSelect(exerciseId: string): void
  onClose(): void
}) {
  const { t } = useT()
  const { exercises } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all')

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return exercises
      .filter((e) => !e.is_archived)
      .filter((e) => category === 'all' || e.category === category)
      .filter((e) => exerciseMatchesQuery(e, needle))
      .sort((a, b) => {
        if ((a.owner_id === null) !== (b.owner_id === null)) return a.owner_id === null ? 1 : -1
        return displayExerciseName(a).localeCompare(displayExerciseName(b), undefined, {
          sensitivity: 'base',
        })
      })
  }, [exercises, query, category])

  return (
    <Modal title={title ?? t('exercises.choose')} onClose={onClose}>
      <div className="field">
        <label htmlFor="exercise-search">{t('common.search')}</label>
        <input
          id="exercise-search"
          className="input"
          type="search"
          placeholder={t('exercises.pickerPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div
        className="row row--wrap"
        style={{ marginBottom: '0.75rem' }}
        role="group"
        aria-label={t('exercises.filterCategory')}
      >
        {(
          [
            { value: 'all', key: 'category.all' },
            { value: 'strength', key: 'category.strength' },
            { value: 'cardio', key: 'category.cardio' },
            { value: 'mobility', key: 'category.mobility' },
          ] as const
        ).map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`btn btn--small ${category === filter.value ? 'btn--primary' : ''}`}
            aria-pressed={category === filter.value}
            onClick={() => setCategory(filter.value)}
          >
            {t(filter.key)}
          </button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="muted">{t('exercises.pickerEmpty')}</p>
      ) : (
        <ul className="picker-list">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                className="picker-item"
                onClick={() => {
                  onSelect(exercise.id)
                  onClose()
                }}
              >
                <span className="picker-name">
                  {displayExerciseName(exercise)}
                  {exercise.owner_id === null ? <small>{t('exercises.systemDot')}</small> : null}
                </span>
                <span className="muted">
                  {categoryLabel(exercise.category)} · {MEASUREMENT_LABELS(exercise.measurement)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

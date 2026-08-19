// Exercise picker modal: search + category filter over the local catalog.
import { useMemo, useState } from 'react'
import type { ExerciseCategory, ExerciseRow } from '../types/db'
import { useStore } from '../lib/store'
import { Modal } from './ui'

const CATEGORY_FILTERS: { value: ExerciseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
]

export function MEASUREMENT_LABELS(measurement: ExerciseRow['measurement']): string {
  switch (measurement) {
    case 'weight_reps':
      return 'Weight × Reps'
    case 'reps':
      return 'Reps'
    case 'duration':
      return 'Duration'
    case 'distance_duration':
      return 'Distance + Duration'
    case 'weight_duration':
      return 'Weight + Hold time'
    default:
      return measurement
  }
}

export function ExercisePicker({
  title = 'Choose exercise',
  onSelect,
  onClose,
}: {
  title?: string
  onSelect(exerciseId: string): void
  onClose(): void
}) {
  const { exercises } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all')

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return exercises
      .filter((e) => !e.is_archived)
      .filter((e) => category === 'all' || e.category === category)
      .filter((e) => needle === '' || e.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        // custom exercises first, then alphabetical
        if ((a.owner_id === null) !== (b.owner_id === null)) return a.owner_id === null ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }, [exercises, query, category])

  return (
    <Modal title={title} onClose={onClose}>
      <div className="field">
        <label htmlFor="exercise-search">Search</label>
        <input
          id="exercise-search"
          className="input"
          type="search"
          placeholder="e.g. squat, run…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="row row--wrap" style={{ marginBottom: '0.75rem' }} role="group" aria-label="Filter by category">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`btn btn--small ${category === filter.value ? 'btn--primary' : ''}`}
            aria-pressed={category === filter.value}
            onClick={() => setCategory(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="muted">No exercises match. You can create a custom one in the Exercises tab.</p>
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
                  {exercise.name}
                  {exercise.owner_id === null ? <small> · system</small> : null}
                </span>
                <span className="muted">
                  {exercise.category} · {MEASUREMENT_LABELS(exercise.measurement)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// Exercises: system catalog (read-only) + custom exercises with editor.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExerciseCategory, ExerciseRow } from '../types/db'
import { useStore } from '../lib/store'
import { EmptyState, Loader } from '../components/ui'
import { MEASUREMENT_LABELS } from '../components/ExercisePicker'
import { IconPlus } from '../components/Icons'
import './exercises.css'

const CATEGORY_FILTERS: { value: ExerciseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
]

export function Exercises() {
  const { exercises, ready } = useStore()
  const navigate = useNavigate()
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return exercises
      .filter((e) => (showArchived ? e.is_archived : !e.is_archived))
      .filter((e) => category === 'all' || e.category === category)
      .filter((e) => needle === '' || e.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        if ((a.owner_id === null) !== (b.owner_id === null)) return a.owner_id === null ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }, [exercises, category, query, showArchived])

  if (!ready) return <Loader />

  return (
    <div>
      <div className="page-head">
        <h1>Exercises</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void navigate('/exercises/new')}
        >
          <IconPlus width={18} height={18} /> New
        </button>
      </div>

      <div className="field">
        <label htmlFor="exercise-filter">Search exercises</label>
        <input
          id="exercise-filter"
          className="input"
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="row row--wrap" role="group" aria-label="Filter by category" style={{ marginBottom: '0.75rem' }}>
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
        <button
          type="button"
          className={`btn btn--small ${showArchived ? 'btn--primary' : ''}`}
          aria-pressed={showArchived}
          onClick={() => setShowArchived((value) => !value)}
        >
          Archived
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No archived exercises' : 'No exercises match'}
          hint={
            showArchived
              ? 'Exercises you archive will appear here.'
              : 'Try a different search or create a custom exercise.'
          }
        />
      ) : (
        <ul className="exercise-list">
          {filtered.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ExerciseCard({ exercise }: { exercise: ExerciseRow }) {
  const navigate = useNavigate()
  const details = [exercise.category, MEASUREMENT_LABELS(exercise.measurement)]
  if (exercise.muscle_groups.length > 0) details.push(exercise.muscle_groups.join(', '))
  return (
    <li className="card" style={{ padding: '0.75rem 0.9rem' }}>
      <button
        type="button"
        className="exercise-card"
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0 }}
        onClick={() => void navigate(`/exercises/${exercise.id}`)}
      >
        <span className="row row--between">
          <strong>
            {exercise.name}{' '}
            {exercise.is_archived ? <span className="badge badge--neutral">Archived</span> : null}
          </strong>
          {exercise.owner_id === null ? (
            <span className="badge badge--neutral">System</span>
          ) : (
            <span className="badge badge--planned">Custom</span>
          )}
        </span>
        <small className="muted">{details.join(' · ')}</small>
      </button>
      {exercise.video_url ? (
        <small style={{ display: 'block', marginTop: '0.35rem' }}>
          <a href={exercise.video_url} target="_blank" rel="noreferrer noopener">
            Form videos ↗
          </a>
        </small>
      ) : null}
    </li>
  )
}

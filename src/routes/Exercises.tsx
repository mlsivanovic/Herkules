// Exercises: system catalog (read-only) + custom exercises with editor.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExerciseCategory, ExerciseRow } from '../types/db'
import { useStore } from '../lib/store'
import { EmptyState, Loader } from '../components/ui'
import { MEASUREMENT_LABELS } from '../components/ExercisePicker'
import { formVideoUrl } from '../lib/video'
import { IconPlus } from '../components/Icons'
import {
  categoryLabel,
  displayExerciseName,
  displayTags,
  exerciseMatchesQuery,
  useT,
} from '../lib/i18n'
import './exercises.css'
import { PlanSectionNav } from '../components/SectionNav'

export function Exercises() {
  const { t } = useT()
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
      .filter((e) => exerciseMatchesQuery(e, needle))
      .sort((a, b) => {
        if ((a.owner_id === null) !== (b.owner_id === null)) return a.owner_id === null ? 1 : -1
        return displayExerciseName(a).localeCompare(displayExerciseName(b), undefined, {
          sensitivity: 'base',
        })
      })
  }, [exercises, category, query, showArchived])

  if (!ready) return <Loader />

  return (
    <div>
      <PlanSectionNav />
      <div className="page-head">
        <h1>{t('exercises.title')}</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void navigate('/exercises/new')}
        >
          <IconPlus width={18} height={18} /> {t('common.new')}
        </button>
      </div>

      <div className="field">
        <label htmlFor="exercise-filter">{t('exercises.search')}</label>
        <input
          id="exercise-filter"
          className="input"
          type="search"
          placeholder={t('exercises.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="row row--wrap" role="group" aria-label={t('exercises.filterCategory')} style={{ marginBottom: '0.75rem' }}>
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
        <button
          type="button"
          className={`btn btn--small ${showArchived ? 'btn--primary' : ''}`}
          aria-pressed={showArchived}
          onClick={() => setShowArchived((value) => !value)}
        >
          {t('common.archived')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={showArchived ? t('exercises.noArchivedTitle') : t('exercises.noMatchTitle')}
          hint={
            showArchived ? t('exercises.noArchivedHint') : t('exercises.noMatchHint')
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
  const { t } = useT()
  const navigate = useNavigate()
  const details = [
    categoryLabel(exercise.category),
    MEASUREMENT_LABELS(exercise.measurement),
  ]
  if (exercise.muscle_groups.length > 0) details.push(displayTags(exercise.muscle_groups))
  const videoHref = formVideoUrl(exercise.name)
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
            {displayExerciseName(exercise)}{' '}
            {exercise.is_archived ? (
              <span className="badge badge--neutral">{t('common.archived')}</span>
            ) : null}
          </strong>
          {exercise.owner_id === null ? (
            <span className="badge badge--neutral">{t('common.system')}</span>
          ) : (
            <span className="badge badge--planned">{t('common.custom')}</span>
          )}
        </span>
        <small className="muted">{details.join(' · ')}</small>
      </button>
      {exercise.source_url || videoHref ? (
        <small className="row row--wrap" style={{ marginTop: '0.35rem' }}>
          {exercise.source_url ? (
            <a href={exercise.source_url} target="_blank" rel="noreferrer noopener">
              {exercise.source_provider
                ? t('exercises.providerGuide', { provider: exercise.source_provider })
                : t('exercises.guide')}
            </a>
          ) : null}
          {videoHref ? (
            <a href={videoHref} target="_blank" rel="noreferrer noopener">
              {t('exercises.youtube')}
            </a>
          ) : null}
        </small>
      ) : null}
    </li>
  )
}

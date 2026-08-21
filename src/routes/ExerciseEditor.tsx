// Exercise detail/editor: system exercises are read-only; custom ones can be
// edited, archived and restored.
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ExerciseCategory, ExerciseMeasurement } from '../types/db'
import { useStore } from '../lib/store'
import { EmptyState } from '../components/ui'
import { validateHttpsUrl, validateRequiredName } from '../lib/validation'
import {
  categoryLabel,
  displayExerciseInstructions,
  displayExerciseName,
  displayTags,
  useT,
} from '../lib/i18n'

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
]

const MEASUREMENTS: { value: ExerciseMeasurement; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × Reps' },
  { value: 'reps', label: 'Reps only' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance_duration', label: 'Distance + Duration' },
  { value: 'weight_duration', label: 'Weight + Hold time (isometrics)' },
  { value: 'weight_distance', label: 'Weight + Distance (carries)' },
]

export function ExerciseEditor() {
  const { t, locale } = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const { exercises, createExercise, updateExercise, ready } = useStore()
  const isNew = id === 'new'
  const exercise = isNew ? null : exercises.find((e) => e.id === id) ?? null

  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('strength')
  const [measurement, setMeasurement] = useState<ExerciseMeasurement>('weight_reps')
  const [muscleGroups, setMuscleGroups] = useState('')
  const [equipment, setEquipment] = useState('')
  const [instructions, setInstructions] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Load once per exercise id: store reloads replace the `exercises` array
  // (new object identity) and must not wipe what the user is typing.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    const loadKey = exercise ? `${exercise.id}:${locale}` : null
    if (exercise && loadedFor !== loadKey) {
      setName(displayExerciseName(exercise))
      setCategory(exercise.category)
      setMeasurement(exercise.measurement)
      setMuscleGroups(
        exercise.owner_id === null ? displayTags(exercise.muscle_groups) : exercise.muscle_groups.join(', '),
      )
      setEquipment(exercise.owner_id === null ? displayTags(exercise.equipment) : exercise.equipment.join(', '))
      setInstructions(displayExerciseInstructions(exercise) ?? '')
      setVideoUrl(exercise.video_url ?? '')
      setLoadedFor(loadKey)
    }
  }, [exercise, loadedFor, locale])

  if (!ready) return null
  if (!isNew && !exercise) {
    return <EmptyState title={t('exercises.notFoundTitle')} hint={t('exercises.notFoundHint')} />
  }

  const isSystem = exercise?.owner_id === null
  const editing = !isSystem

  function splitList(value: string): string[] {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation =
      validateRequiredName(name, t('exercises.nameRequired')) ?? validateHttpsUrl(videoUrl)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    const input = {
      name: name.trim(),
      category,
      measurement,
      muscle_groups: splitList(muscleGroups),
      equipment: splitList(equipment),
      instructions: instructions.trim() === '' ? null : instructions.trim(),
      video_url: videoUrl.trim() === '' ? null : videoUrl.trim(),
    }
    try {
      if (isNew) {
        await createExercise(input)
      } else if (exercise) {
        await updateExercise(exercise.id, input)
      }
      void navigate('/exercises')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.saveExercise'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleArchive() {
    if (!exercise) return
    try {
      await updateExercise(exercise.id, { is_archived: !exercise.is_archived })
      void navigate('/exercises')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.updateExercise'))
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isNew ? t('exercises.newTitle') : exercise ? displayExerciseName(exercise) : ''}</h1>
        {isSystem ? <span className="badge badge--neutral">{t('exercises.systemReadonly')}</span> : null}
      </div>

      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset disabled={!editing && !isNew} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="field">
            <label htmlFor="exercise-name">{t('exercises.name')}</label>
            <input
              id="exercise-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-category">{t('exercises.category')}</label>
            <select
              id="exercise-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            >
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {categoryLabel(option.value)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="exercise-measurement">{t('exercises.measuredBy')}</label>
            <select
              id="exercise-measurement"
              className="input"
              value={measurement}
              onChange={(e) => setMeasurement(e.target.value as ExerciseMeasurement)}
            >
              {MEASUREMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(
                    option.value === 'weight_reps'
                      ? 'measurement.weight_reps'
                      : option.value === 'reps'
                        ? 'measurement.repsOnly'
                        : option.value === 'duration'
                          ? 'measurement.duration'
                          : option.value === 'distance_duration'
                            ? 'measurement.distance_duration'
                            : option.value === 'weight_duration'
                              ? 'measurement.weight_durationLong'
                              : 'measurement.weight_distanceLong',
                  )}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="exercise-muscles">{t('exercises.muscles')}</label>
            <input
              id="exercise-muscles"
              className="input"
              placeholder={t('exercises.musclesPh')}
              value={muscleGroups}
              onChange={(e) => setMuscleGroups(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-equipment">{t('exercises.equipment')}</label>
            <input
              id="exercise-equipment"
              className="input"
              placeholder={t('exercises.equipmentPh')}
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-instructions">{t('exercises.instructions')}</label>
            <textarea
              id="exercise-instructions"
              className="input"
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-video">{t('exercises.video')}</label>
            <input
              id="exercise-video"
              className="input"
              type="url"
              placeholder={t('exercises.videoPh')}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>
        </fieldset>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row row--wrap" style={{ marginTop: '1rem' }}>
          {editing || isNew ? (
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? t('common.saving') : t('exercises.save')}
            </button>
          ) : null}
          {exercise && !isSystem ? (
            <button
              type="button"
              className="btn"
              onClick={() => void toggleArchive()}
            >
              {exercise.is_archived ? t('exercises.restore') : t('exercises.archive')}
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={() => void navigate('/exercises')}>
            {t('common.back')}
          </button>
        </div>
      </form>
      {exercise?.source_url || exercise?.video_url ? (
        <div className="stack" style={{ marginTop: '1rem' }}>
          {exercise?.source_url ? (
            <a href={exercise.source_url} target="_blank" rel="noreferrer noopener">
              {exercise.source_provider
                ? t('exercises.providerGuide', { provider: exercise.source_provider })
                : t('exercises.guide')}
            </a>
          ) : null}
          {exercise?.video_url ? (
          <a href={exercise.video_url} target="_blank" rel="noreferrer noopener">
            {exercise.video_url.includes('youtube.com/results')
              ? t('exercises.youtube')
              : t('exercises.guide')}
          </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

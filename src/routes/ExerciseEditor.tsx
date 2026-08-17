// Exercise detail/editor: system exercises are read-only; custom ones can be
// edited, archived and restored.
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ExerciseCategory, ExerciseMeasurement } from '../types/db'
import { useStore } from '../lib/store'
import { EmptyState } from '../components/ui'
import { validateHttpsUrl, validateRequiredName } from '../lib/validation'

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
]

export function ExerciseEditor() {
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

  useEffect(() => {
    if (exercise) {
      setName(exercise.name)
      setCategory(exercise.category)
      setMeasurement(exercise.measurement)
      setMuscleGroups(exercise.muscle_groups.join(', '))
      setEquipment(exercise.equipment.join(', '))
      setInstructions(exercise.instructions ?? '')
      setVideoUrl(exercise.video_url ?? '')
    }
  }, [exercise])

  if (!ready) return null
  if (!isNew && !exercise) {
    return <EmptyState title="Exercise not found" hint="It may have been removed." />
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
      validateRequiredName(name, 'Exercise name') ?? validateHttpsUrl(videoUrl)
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
      setError(caught instanceof Error ? caught.message : 'Could not save the exercise.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isNew ? 'New exercise' : exercise?.name}</h1>
        {isSystem ? <span className="badge badge--neutral">System · read-only</span> : null}
      </div>

      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset disabled={!editing && !isNew} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="field">
            <label htmlFor="exercise-name">Name</label>
            <input
              id="exercise-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-category">Category</label>
            <select
              id="exercise-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            >
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="exercise-measurement">Measured by</label>
            <select
              id="exercise-measurement"
              className="input"
              value={measurement}
              onChange={(e) => setMeasurement(e.target.value as ExerciseMeasurement)}
            >
              {MEASUREMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="exercise-muscles">Muscle groups (comma separated)</label>
            <input
              id="exercise-muscles"
              className="input"
              placeholder="e.g. chest, triceps"
              value={muscleGroups}
              onChange={(e) => setMuscleGroups(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-equipment">Equipment (comma separated)</label>
            <input
              id="exercise-equipment"
              className="input"
              placeholder="e.g. barbell, bench"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              readOnly={!editing && !isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="exercise-instructions">Instructions</label>
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
            <label htmlFor="exercise-video">Video link (optional, https://)</label>
            <input
              id="exercise-video"
              className="input"
              type="url"
              placeholder="https://…"
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
              {busy ? 'Saving…' : 'Save exercise'}
            </button>
          ) : null}
          {exercise && !isSystem ? (
            <button
              type="button"
              className="btn"
              onClick={() =>
                void updateExercise(exercise.id, { is_archived: !exercise.is_archived }).then(() =>
                  void navigate('/exercises'),
                )
              }
            >
              {exercise.is_archived ? 'Restore' : 'Archive'}
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={() => void navigate('/exercises')}>
            Back
          </button>
        </div>
      </form>
      {exercise?.video_url ? (
        <p style={{ marginTop: '1rem' }}>
          <a href={exercise.video_url} target="_blank" rel="noreferrer noopener">
            Open video explanation ↗
          </a>
        </p>
      ) : null}
    </div>
  )
}

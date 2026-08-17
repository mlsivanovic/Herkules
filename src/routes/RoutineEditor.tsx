// Routine editor: exercise order, planned sets, targets, rest, notes and
// superset/circuit grouping.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, newId, type TemplateItemInput } from '../lib/store'
import type { ExerciseMeasurement } from '../types/db'
import { EmptyState, Modal } from '../components/ui'
import { ExercisePicker, MEASUREMENT_LABELS } from '../components/ExercisePicker'
import { validateRequiredName } from '../lib/validation'
import {
  distanceUnitLabel,
  weightUnitLabel,
} from '../lib/units'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '../components/Icons'
import './routineEditor.css'

function newItem(exerciseId: string, position: number): TemplateItemInput {
  return {
    id: null,
    exercise_id: exerciseId,
    position,
    planned_sets: 3,
    target_weight_kg: null,
    target_reps: null,
    target_duration_s: null,
    target_distance_m: null,
    rest_seconds: 90,
    notes: null,
    superset_group: null,
  }
}

export function RoutineEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const store = useStore()
  const { templates, templateItems, exercises, ready } = store

  const template = isNew ? null : templates.find((t) => t.id === id) ?? null

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<TemplateItemInput[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (template && loadedFor !== template.id) {
      setName(template.name)
      setNotes(template.notes ?? '')
      setItems(
        templateItems
          .filter((i) => i.template_id === template.id)
          .sort((a, b) => a.position - b.position)
          .map((i) => ({ ...i })),
      )
      setLoadedFor(template.id)
    }
  }, [template, templateItems, loadedFor])

  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  if (ready && !isNew && !template) {
    return <EmptyState title="Routine not found" hint="It may have been deleted." />
  }

  function update(index: number, patch: Partial<TemplateItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function move(index: number, delta: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(target, 0, moved)
      return next
    })
  }

  /** Toggle superset grouping on an item: consecutive items sharing a group
   * id form a superset/circuit block. */
  function toggleSuperset(index: number) {
    setItems((prev) => {
      const next = [...prev]
      const item = next[index]
      if (!item) return prev
      if (item.superset_group) {
        next[index] = { ...item, superset_group: null }
      } else {
        const neighbor = next[index + 1] ?? next[index - 1]
        const group = neighbor?.superset_group ?? newId()
        next[index] = { ...item, superset_group: group }
        if (neighbor && !neighbor.superset_group && next[index + 1]) {
          next[index + 1] = { ...next[index + 1], superset_group: group } as TemplateItemInput
        }
      }
      return next
    })
  }

  async function save() {
    const validation = validateRequiredName(name, 'Routine name')
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      let templateId: string
      if (isNew) {
        const created = await store.createTemplate(name.trim(), notes.trim() === '' ? null : notes.trim())
        templateId = created.id
      } else if (template) {
        templateId = template.id
        await store.updateTemplate(templateId, {
          name: name.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
        })
      } else {
        return
      }
      await store.saveTemplateItems(
        templateId,
        items.map((item, index) => ({ ...item, position: index })),
      )
      void navigate('/routines')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the routine.')
    } finally {
      setBusy(false)
    }
  }

  async function removeRoutine() {
    if (!template) return
    if (window.confirm(`Delete routine "${template.name}"? Planned history is not affected.`)) {
      await store.deleteTemplate(template.id)
      void navigate('/routines')
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isNew ? 'New routine' : 'Edit routine'}</h1>
      </div>

      <div className="field">
        <label htmlFor="routine-name">Name</label>
        <input
          id="routine-name"
          className="input"
          placeholder="e.g. Push Day A"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="routine-notes">Notes (optional)</label>
        <textarea
          id="routine-notes"
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="section-title">Exercises</div>
      {items.length === 0 ? (
        <p className="muted">No exercises yet — add the first one.</p>
      ) : (
        <ol className="routine-items">
          {items.map((item, index) => {
            const exercise = exerciseById.get(item.exercise_id)
            const measurement: ExerciseMeasurement = exercise?.measurement ?? 'weight_reps'
            return (
              <li key={item.id ?? `draft-${index}`} className={item.superset_group ? 'routine-item--superset' : ''}>
                <div className="row row--between">
                  <strong>{exercise?.name ?? 'Unknown exercise'}</strong>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn--icon btn--small"
                      aria-label={`Move ${exercise?.name ?? 'exercise'} up`}
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <IconArrowUp width={16} height={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--small"
                      aria-label={`Move ${exercise?.name ?? 'exercise'} down`}
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      <IconArrowDown width={16} height={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--small btn--danger"
                      aria-label={`Remove ${exercise?.name ?? 'exercise'}`}
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </div>
                <small className="muted">
                  {exercise?.category} · {MEASUREMENT_LABELS(measurement)}
                </small>

                <div className="routine-grid">
                  <label className="field">
                    <span>Sets</span>
                    <input
                      className="input input--cell"
                      type="number"
                      min={1}
                      max={30}
                      value={item.planned_sets}
                      onChange={(e) =>
                        update(index, {
                          planned_sets: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                        })
                      }
                    />
                  </label>

                  {measurement === 'weight_reps' ? (
                    <>
                      <label className="field">
                        <span>Target {weightUnitLabel(store.profile?.unit_system ?? 'metric')}</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          step="0.5"
                          value={item.target_weight_kg ?? ''}
                          onChange={(e) =>
                            update(index, {
                              target_weight_kg: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Target reps</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          value={item.target_reps ?? ''}
                          onChange={(e) =>
                            update(index, {
                              target_reps: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  {measurement === 'reps' ? (
                    <label className="field">
                      <span>Target reps</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        value={item.target_reps ?? ''}
                        onChange={(e) =>
                          update(index, {
                            target_reps: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ) : null}

                  {measurement === 'duration' || measurement === 'distance_duration' ? (
                    <label className="field">
                      <span>Target seconds</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        value={item.target_duration_s ?? ''}
                        onChange={(e) =>
                          update(index, {
                            target_duration_s: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ) : null}

                  {measurement === 'distance_duration' ? (
                    <label className="field">
                      <span>Target {distanceUnitLabel(store.profile?.unit_system ?? 'metric')}</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        step="0.1"
                        value={item.target_distance_m ?? ''}
                        onChange={(e) =>
                          update(index, {
                            target_distance_m: e.target.value === '' ? null : Number(e.target.value) * 1000,
                          })
                        }
                      />
                    </label>
                  ) : null}

                  <label className="field">
                    <span>Rest (s)</span>
                    <input
                      className="input input--cell"
                      type="number"
                      min={0}
                      max={3600}
                      value={item.rest_seconds ?? ''}
                      onChange={(e) =>
                        update(index, {
                          rest_seconds: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Notes</span>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Tempo, RPE, cues, per side…"
                    value={item.notes ?? ''}
                    onChange={(e) =>
                      update(index, { notes: e.target.value === '' ? null : e.target.value })
                    }
                  />
                </label>

                <button
                  type="button"
                  className={`btn btn--small ${item.superset_group ? 'btn--accent' : ''}`}
                  aria-pressed={Boolean(item.superset_group)}
                  onClick={() => toggleSuperset(index)}
                >
                  {item.superset_group ? 'In superset — remove' : 'Superset with next'}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={() => setPickerOpen(true)}>
        <IconPlus width={18} height={18} /> Add exercise
      </button>

      {error ? (
        <p className="field-error" role="alert" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}

      <div className="row row--wrap" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save routine'}
        </button>
        {!isNew && template ? (
          <button type="button" className="btn btn--danger" onClick={() => void removeRoutine()}>
            Delete
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={() => void navigate('/routines')}>
          Back
        </button>
      </div>

      {pickerOpen ? (
        <Modal title="Add exercise to routine" onClose={() => setPickerOpen(false)}>
          <ExercisePicker
            onClose={() => setPickerOpen(false)}
            onSelect={(exerciseId) =>
              setItems((prev) => [...prev, newItem(exerciseId, prev.length)])
            }
          />
        </Modal>
      ) : null}
    </div>
  )
}

// Routine editor: exercise order, planned sets, targets, rest, notes and
// superset/circuit grouping.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, newId, type TemplateItemInput } from '../lib/store'
import type { ExerciseMeasurement } from '../types/db'
import { EmptyState, Modal } from '../components/ui'
import { ExercisePicker, MEASUREMENT_LABELS } from '../components/ExercisePicker'
import { validateRequiredName } from '../lib/validation'
import { BLOCK_ROLES, blockRoleClass, normalizeBlockRole } from '../lib/blockRole'
import { moveIndex, supersetPartners } from '../lib/reorder'
import { usePointerReorder } from '../lib/usePointerReorder'
import {
  distanceForInput,
  distanceToM,
  distanceUnitLabel,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import { IconGrip, IconPlus, IconTrash } from '../components/Icons'
import { downloadTextFile, routinesExportFilename } from '../lib/routinesIo'
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
    block_role: 'gym',
  }
}

export function RoutineEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const store = useStore()
  const { templates, templateItems, exercises, ready } = store

  const template = isNew ? null : templates.find((t) => t.id === id) ?? null
  const units = store.profile?.unit_system ?? 'metric'

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<TemplateItemInput[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [openNotes, setOpenNotes] = useState<Record<number, boolean>>({})
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    if (template && loadedFor !== template.id) {
      setName(template.name)
      setNotes(template.notes ?? '')
      setItems(
        templateItems
          .filter((i) => i.template_id === template.id)
          .sort((a, b) => a.position - b.position)
          .map((i) => ({ ...i, block_role: normalizeBlockRole(i.block_role) })),
      )
      setLoadedFor(template.id)
    }
  }, [template, templateItems, loadedFor])

  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const moveTo = useCallback((from: number, to: number) => {
    setItems((prev) => moveIndex(prev, from, to))
    setOpenNotes({})
  }, [])

  const reorder = usePointerReorder({
    itemCount: items.length,
    onMove: moveTo,
    announce: setAnnounce,
  })

  if (ready && !isNew && !template) {
    return <EmptyState title="Routine not found" hint="It may have been deleted." />
  }

  function update(index: number, patch: Partial<TemplateItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
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
      try {
        await store.deleteTemplate(template.id)
        void navigate('/routines')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not delete the routine.')
      }
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
            const name = exercise?.name ?? 'Unknown exercise'
            const partners = supersetPartners(items, item, (row) => {
              return exerciseById.get(row.exercise_id)?.name ?? 'Unknown exercise'
            })
            const notesOpen = Boolean(openNotes[index])
            const dragging = reorder.active?.from === index
            const dropTarget =
              reorder.active !== null &&
              reorder.active.over === index &&
              reorder.active.from !== index
            return (
              <li
                key={item.id ?? `draft-${index}`}
                ref={reorder.setItemRef(index)}
                className={`exercise-card-item ${blockRoleClass(item.block_role)}${item.superset_group ? ' routine-item--superset' : ''}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
              >
                <div className="exercise-head">
                  <div className="exercise-head__drag" {...reorder.getHandleProps(index)}>
                    <button
                      type="button"
                      className="exercise-grip"
                      aria-label={`Reorder ${name}`}
                      {...reorder.getHandleProps(index, { immediate: true })}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowUp' || (event.altKey && event.key === 'ArrowUp')) {
                          event.preventDefault()
                          reorder.moveBy(index, -1)
                        } else if (
                          event.key === 'ArrowDown' ||
                          (event.altKey && event.key === 'ArrowDown')
                        ) {
                          event.preventDefault()
                          reorder.moveBy(index, 1)
                        }
                      }}
                    >
                      <IconGrip width={16} height={16} />
                    </button>
                    <strong className="exercise-head__title">{name}</strong>
                  </div>
                  {exercise?.video_url ? (
                    <a
                      href={exercise.video_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="form-chip"
                      aria-label={`Form video for ${name}`}
                    >
                      Form ↗
                    </a>
                  ) : null}
                </div>
                {partners.length > 0 ? (
                  <div className="exercise-superset">
                    <span className="badge badge--in-progress">Superset</span>
                    <span className="exercise-superset__with">with {partners.join(', ')}</span>
                  </div>
                ) : null}
                <div className="row row--wrap" role="group" aria-label={`Role for ${name}`}>
                  {BLOCK_ROLES.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      className={`btn btn--small role-chip role-chip--${role.value}${normalizeBlockRole(item.block_role) === role.value ? ' is-selected' : ''}`}
                      aria-pressed={normalizeBlockRole(item.block_role) === role.value}
                      onClick={() => update(index, { block_role: role.value })}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>

                <div className="exercise-meta-row">
                  <small className="muted">
                    {exercise?.category} · {MEASUREMENT_LABELS(measurement)}
                  </small>
                  <button
                    type="button"
                    className="btn btn--icon btn--small btn--danger"
                    data-no-drag
                    aria-label={`Remove ${name}`}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>

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
                        <span>Target {weightUnitLabel(units)}</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          step="0.5"
                          value={weightForInput(item.target_weight_kg, units)}
                          onChange={(e) =>
                            update(index, {
                              target_weight_kg:
                                e.target.value === '' ? null : weightToKg(Number(e.target.value), units),
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

                  {measurement === 'weight_duration' ? (
                    <>
                      <label className="field">
                        <span>Target {weightUnitLabel(units)}</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          step="0.5"
                          value={weightForInput(item.target_weight_kg, units)}
                          onChange={(e) =>
                            update(index, {
                              target_weight_kg:
                                e.target.value === '' ? null : weightToKg(Number(e.target.value), units),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Target hold (s)</span>
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
                    </>
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
                      <span>Target {distanceUnitLabel(units)}</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        step="0.1"
                        value={distanceForInput(item.target_distance_m, units)}
                        onChange={(e) =>
                          update(index, {
                            target_distance_m:
                              e.target.value === '' ? null : distanceToM(Number(e.target.value), units),
                          })
                        }
                      />
                    </label>
                  ) : null}

                  <label className="field">
                    <span>Tempo</span>
                    <input
                      className="input input--cell"
                      type="text"
                      inputMode="text"
                      placeholder="3-0-1"
                      maxLength={16}
                      value={item.tempo ?? ''}
                      onChange={(e) =>
                        update(index, {
                          tempo: e.target.value.trim() === '' ? null : e.target.value.trim(),
                        })
                      }
                    />
                  </label>

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

                <button
                  type="button"
                  className={`notes-chip${item.notes ? ' notes-chip--filled' : ''}`}
                  aria-expanded={notesOpen}
                  onClick={() =>
                    setOpenNotes((prev) => ({ ...prev, [index]: !prev[index] }))
                  }
                >
                  Notes
                </button>
                {notesOpen ? (
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
                ) : null}

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
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>

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
          <>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                void store
                  .exportRoutines([template.id])
                  .then((json) => {
                    downloadTextFile(
                      routinesExportFilename(template.name),
                      json,
                      'application/json',
                    )
                  })
                  .catch((caught: unknown) => {
                    setError(
                      caught instanceof Error ? caught.message : 'Could not export the routine.',
                    )
                  })
              }}
            >
              Export
            </button>
            <button type="button" className="btn btn--danger" onClick={() => void removeRoutine()}>
              Delete
            </button>
          </>
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

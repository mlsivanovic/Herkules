// Routine editor: exercise order, planned sets, targets, rest, notes and
// superset/circuit grouping.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore, newId, type TemplateItemInput } from '../lib/store'
import type { ExerciseMeasurement } from '../types/db'
import { EmptyState, Modal } from '../components/ui'
import { ExercisePicker, MEASUREMENT_LABELS } from '../components/ExercisePicker'
import { validateRequiredName } from '../lib/validation'
import { blockRoles, blockRoleClass, normalizeBlockRole } from '../lib/blockRole'
import { displayExerciseName } from '../lib/i18n'
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
    block_id: null,
    block_position: position,
    target_reps_min: null,
    target_reps_max: null,
    target_duration_min_s: null,
    target_duration_max_s: null,
    target_distance_min_m: null,
    target_distance_max_m: null,
    target_rpe_min: null,
    target_rpe_max: null,
    target_rir_min: null,
    target_rir_max: null,
    side_mode: 'bilateral',
    directions: 1,
    load_increment_kg: null,
    tempo_eccentric: null,
    tempo_stretch_pause: null,
    tempo_concentric: null,
    tempo_contracted_pause: null,
    tempo_intent: 'controlled',
  }
}

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

const NEW_PLAN = '__new__'

export function RoutineEditor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const store = useStore()
  const { templates, templateItems, templateBlocks, exercises, plans, ready } = store

  const template = isNew ? null : templates.find((t) => t.id === id) ?? null
  const units = store.profile?.unit_system ?? 'metric'
  const queryPlan = searchParams.get('plan')

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [planChoice, setPlanChoice] = useState(queryPlan ?? '')
  const [newPlanName, setNewPlanName] = useState('')
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
      setPlanChoice(template.plan_id ?? '')
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
      let assignedPlanId: string | null = null
      if (planChoice === NEW_PLAN) {
        const planValidation = validateRequiredName(newPlanName, 'Plan name')
        if (planValidation) {
          setError(planValidation)
          setBusy(false)
          return
        }
        const createdPlan = await store.createPlan(newPlanName.trim(), null)
        assignedPlanId = createdPlan.id
      } else {
        assignedPlanId = planChoice === '' ? null : planChoice
      }

      let templateId: string
      if (isNew) {
        const created = await store.createTemplate(
          name.trim(),
          notes.trim() === '' ? null : notes.trim(),
          assignedPlanId,
        )
        templateId = created.id
      } else if (template) {
        templateId = template.id
        await store.updateTemplate(templateId, {
          name: name.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
        })
        if ((template.plan_id ?? null) !== assignedPlanId) {
          await store.assignTemplateToPlan(templateId, assignedPlanId)
        }
      } else {
        return
      }
      await store.saveTemplateItems(
        templateId,
        items.map((item, index) => ({ ...item, position: index })),
      )
      void navigate(assignedPlanId ? `/plans/${assignedPlanId}` : '/routines')
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
      <div className="field">
        <label htmlFor="routine-plan">Training plan</label>
        <select
          id="routine-plan"
          className="input"
          value={planChoice}
          onChange={(e) => setPlanChoice(e.target.value)}
        >
          <option value="">None — unassigned</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
          <option value={NEW_PLAN}>New plan…</option>
        </select>
      </div>
      {planChoice === NEW_PLAN ? (
        <div className="field">
          <label htmlFor="routine-new-plan">New plan name</label>
          <input
            id="routine-new-plan"
            className="input"
            placeholder="e.g. Push / Pull / Legs"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
          />
        </div>
      ) : null}

      <div className="section-title">Exercises</div>
      {items.length === 0 ? (
        <p className="muted">No exercises yet — add the first one.</p>
      ) : (
        <ol className="routine-items">
          {items.map((item, index) => {
            const exercise = exerciseById.get(item.exercise_id)
            const measurement: ExerciseMeasurement = exercise?.measurement ?? 'weight_reps'
            const name = exercise ? displayExerciseName(exercise) : 'Unknown exercise'
            const itemBlock = item.block_id
              ? templateBlocks.find((block) => block.id === item.block_id) ?? null
              : null
            const blockPartners = itemBlock?.format === 'superset'
              ? items
                .filter((row) => row.block_id === item.block_id && row !== item)
                .map((row) => exerciseById.get(row.exercise_id)?.name ?? 'Unknown exercise')
              : []
            const legacyPartners = supersetPartners(items, item, (row) => {
              return exerciseById.get(row.exercise_id)?.name ?? 'Unknown exercise'
            })
            const partners = blockPartners.length > 0 ? blockPartners : legacyPartners
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
                className={`exercise-card-item ${blockRoleClass(item.block_role)}${item.superset_group || itemBlock?.format === 'superset' ? ' routine-item--superset' : ''}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
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
                      className="form-link-icon"
                      aria-label={`Watch form video for ${name}`}
                      title={`Watch form video for ${name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span aria-hidden="true">▶️</span>
                    </a>
                  ) : null}
                </div>
                {exercise?.source_url && exercise.source_url !== exercise.video_url ? (
                  <div className="exercise-guide-row">
                    <a
                      href={exercise.source_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="form-link-icon"
                      aria-label={`Open guide for ${name}`}
                      title={`Open guide for ${name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span aria-hidden="true">📖</span>
                    </a>
                  </div>
                ) : null}
                {partners.length > 0 ? (
                  <div className="exercise-superset">
                    <span className="badge badge--in-progress">Superset</span>
                    <span className="exercise-superset__with">with {partners.join(', ')}</span>
                  </div>
                ) : null}
                {item.block_id ? (
                  <div className="exercise-superset">
                    <span className="badge badge--neutral">
                      {itemBlock?.role.replace('_', ' ') ?? 'block'}
                    </span>
                    <span className="exercise-superset__with">
                      {itemBlock?.format}
                    </span>
                  </div>
                ) : null}
                <div className="row row--wrap" role="group" aria-label={`Role for ${name}`}>
                  {blockRoles().map((role) => (
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
                        <span>Min reps</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          value={item.target_reps_min ?? item.target_reps ?? ''}
                          onChange={(e) => update(index, { target_reps_min: e.target.value === '' ? null : Number(e.target.value) })}
                        />
                      </label>
                      <label className="field">
                        <span>Max reps</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          value={item.target_reps_max ?? item.target_reps ?? ''}
                          onChange={(e) =>
                            update(index, {
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
                      <span>Min reps</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        value={item.target_reps_min ?? item.target_reps ?? ''}
                        onChange={(e) =>
                          update(index, {
                            target_reps_min: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Max reps</span>
                      <input className="input input--cell" type="number" min={0} value={item.target_reps_max ?? item.target_reps ?? ''} onChange={(e) => update(index, { target_reps: e.target.value === '' ? null : Number(e.target.value), target_reps_max: e.target.value === '' ? null : Number(e.target.value) })} />
                    </label>
                    </>
                  ) : null}

                  {measurement === 'weight_distance' ? (
                    <>
                      <label className="field">
                        <span>Target {weightUnitLabel(units)}</span>
                        <input className="input input--cell" type="number" min={0} step="0.5" value={weightForInput(item.target_weight_kg, units)} onChange={(e) => update(index, { target_weight_kg: e.target.value === '' ? null : weightToKg(Number(e.target.value), units) })} />
                      </label>
                      <label className="field">
                        <span>Min {distanceUnitLabel(units)}</span>
                        <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_min_m ?? item.target_distance_m, units)} onChange={(e) => update(index, { target_distance_min_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
                      </label>
                      <label className="field">
                        <span>Max {distanceUnitLabel(units)}</span>
                        <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_max_m ?? item.target_distance_m, units)} onChange={(e) => update(index, { target_distance_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units), target_distance_max_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
                      </label>
                    </>
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
                        <span>Min hold (s)</span>
                        <input
                          className="input input--cell"
                          type="number"
                          min={0}
                          value={item.target_duration_min_s ?? item.target_duration_s ?? ''}
                          onChange={(e) =>
                            update(index, {
                              target_duration_min_s: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Max hold (s)</span>
                        <input className="input input--cell" type="number" min={0} value={item.target_duration_max_s ?? item.target_duration_s ?? ''} onChange={(e) => update(index, { target_duration_s: e.target.value === '' ? null : Number(e.target.value), target_duration_max_s: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                    </>
                  ) : null}

                  {measurement === 'duration' || measurement === 'distance_duration' ? (
                    <>
                      <label className="field">
                        <span>Min seconds</span>
                        <input className="input input--cell" type="number" min={0} value={item.target_duration_min_s ?? item.target_duration_s ?? ''} onChange={(e) => update(index, { target_duration_min_s: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                      <label className="field">
                        <span>Max seconds</span>
                        <input className="input input--cell" type="number" min={0} value={item.target_duration_max_s ?? item.target_duration_s ?? ''} onChange={(e) => update(index, { target_duration_s: e.target.value === '' ? null : Number(e.target.value), target_duration_max_s: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                    </>
                  ) : null}

                  {measurement === 'distance_duration' ? (
                    <>
                      <label className="field">
                      <span>Min {distanceUnitLabel(units)}</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        step="0.1"
                        value={distanceForInput(item.target_distance_min_m ?? item.target_distance_m, units)}
                        onChange={(e) =>
                          update(index, {
                            target_distance_min_m:
                              e.target.value === '' ? null : distanceToM(Number(e.target.value), units),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Max {distanceUnitLabel(units)}</span>
                      <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_max_m ?? item.target_distance_m, units)} onChange={(e) => update(index, { target_distance_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units), target_distance_max_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
                    </label>
                    </>
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
                  {([
                    ['tempo_eccentric', 'Eccentric (s)'],
                    ['tempo_stretch_pause', 'Stretch pause (s)'],
                    ['tempo_concentric', 'Concentric (s)'],
                    ['tempo_contracted_pause', 'Contracted pause (s)'],
                  ] as const).map(([field, label]) => (
                    <label className="field" key={field}>
                      <span>{label}</span>
                      <input
                        className="input input--cell"
                        type="number"
                        min={0}
                        step="0.5"
                        value={item[field] ?? ''}
                        onChange={(e) => {
                          const patch = { [field]: e.target.value === '' ? null : Number(e.target.value) }
                          update(index, { ...patch, tempo: structuredTempo(item, patch) })
                        }}
                      />
                    </label>
                  ))}
                  <label className="field">
                    <span>Side mode</span>
                    <select className="input input--cell" value={item.side_mode ?? 'bilateral'} onChange={(e) => update(index, { side_mode: e.target.value as NonNullable<TemplateItemInput['side_mode']> })}>
                      <option value="bilateral">Bilateral / total</option>
                      <option value="per_side">Per side</option>
                      <option value="per_leg">Per leg</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Directions</span>
                    <input className="input input--cell" type="number" min={1} max={4} value={item.directions ?? 1} onChange={(e) => update(index, { directions: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })} />
                  </label>
                  <label className="field">
                    <span>Target RPE min</span>
                    <input className="input input--cell" type="number" min={1} max={10} step="0.5" value={item.target_rpe_min ?? ''} onChange={(e) => update(index, { target_rpe_min: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Target RPE max</span>
                    <input className="input input--cell" type="number" min={1} max={10} step="0.5" value={item.target_rpe_max ?? ''} onChange={(e) => update(index, { target_rpe_max: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Target RIR min</span>
                    <input className="input input--cell" type="number" min={0} max={10} step="0.5" value={item.target_rir_min ?? ''} onChange={(e) => update(index, { target_rir_min: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Target RIR max</span>
                    <input className="input input--cell" type="number" min={0} max={10} step="0.5" value={item.target_rir_max ?? ''} onChange={(e) => update(index, { target_rir_max: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Load increment (kg)</span>
                    <input className="input input--cell" type="number" min={0} step="0.5" value={item.load_increment_kg ?? ''} onChange={(e) => update(index, { load_increment_kg: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Tempo intent</span>
                    <select className="input input--cell" value={item.tempo_intent ?? 'controlled'} onChange={(e) => {
                      const patch = { tempo_intent: e.target.value as 'controlled' | 'explosive' }
                      update(index, { ...patch, tempo: structuredTempo(item, patch) })
                    }}>
                      <option value="controlled">Controlled</option>
                      <option value="explosive">Explosive</option>
                    </select>
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

                {itemBlock ? (
                  <small className="muted">Grouping is managed by this V2 block.</small>
                ) : (
                  <button
                    type="button"
                    className={`btn btn--small ${item.superset_group ? 'btn--accent' : ''}`}
                    aria-pressed={Boolean(item.superset_group)}
                    onClick={() => toggleSuperset(index)}
                  >
                    {item.superset_group ? 'In superset — remove' : 'Superset with next'}
                  </button>
                )}
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

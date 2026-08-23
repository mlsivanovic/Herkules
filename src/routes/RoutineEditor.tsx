// Routine editor: exercise order, planned sets, targets, rest, notes and
// superset/circuit grouping.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore, newId, type TemplateItemInput } from '../lib/store'
import type { ExerciseMeasurement } from '../types/db'
import { EmptyState, Modal, NotesDisclosure } from '../components/ui'
import { ExercisePicker, MEASUREMENT_LABELS } from '../components/ExercisePicker'
import { validateRequiredName } from '../lib/validation'
import { blockRoles, blockRoleClass, normalizeBlockRole } from '../lib/blockRole'
import {
  blockFormatLabel,
  categoryLabel,
  displayExerciseName,
  useT,
  workoutRoleLabel,
} from '../lib/i18n'
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
import { isBodyweightLoadExercise } from '../lib/bodyweightLoad'
import { downloadTextFile, routinesExportFilename } from '../lib/routinesIo'
import './routineEditor.css'

function newItem(exerciseId: string, position: number, isWarmup = false): TemplateItemInput {
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
    is_warmup: isWarmup,
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
  const { t } = useT()
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
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
          .map((i) => {
            const itemBlock = i.block_id
              ? templateBlocks.find((block) => block.id === i.block_id)
              : null
            return {
              ...i,
              block_role: normalizeBlockRole(i.block_role),
              is_warmup: i.is_warmup === true || itemBlock?.role === 'warmup',
            }
          }),
      )
      setExpanded(new Set())
      setLoadedFor(template.id)
    }
  }, [template, templateItems, templateBlocks, loadedFor])

  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const moveTo = useCallback((from: number, to: number) => {
    setItems((prev) => moveIndex(prev, from, to))
    setOpenNotes({})
    setExpanded((prev) => {
      const next = new Set<number>()
      for (const index of prev) {
        if (index === from) next.add(to)
        else if (from < to && index > from && index <= to) next.add(index - 1)
        else if (to < from && index >= to && index < from) next.add(index + 1)
        else next.add(index)
      }
      return next
    })
  }, [])

  const reorder = usePointerReorder({
    itemCount: items.length,
    onMove: moveTo,
    announce: setAnnounce,
  })

  if (ready && !isNew && !template) {
    return <EmptyState title={t('errors.routineNotFound')} hint={t('common.mayHaveDeleted')} />
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
    const validation = validateRequiredName(name, t('editor.routineName'))
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      let assignedPlanId: string | null = null
      if (planChoice === NEW_PLAN) {
        const planValidation = validateRequiredName(newPlanName, t('editor.planName'))
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
      setError(caught instanceof Error ? caught.message : t('errors.saveRoutine'))
    } finally {
      setBusy(false)
    }
  }

  async function removeRoutine() {
    if (!template) return
    if (window.confirm(t('editor.deleteRoutineConfirm', { name: template.name }))) {
      try {
        await store.deleteTemplate(template.id)
        void navigate('/routines')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('errors.deleteRoutine'))
      }
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isNew ? t('editor.newTitle') : t('editor.editTitle')}</h1>
      </div>

      <div className="field">
        <label htmlFor="routine-name">{t('editor.nameLabel')}</label>
        <input
          id="routine-name"
          className="input"
          placeholder={t('editor.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="routine-notes">{t('editor.notes')}</label>
        <textarea
          id="routine-notes"
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="routine-plan">{t('editor.trainingPlan')}</label>
        <select
          id="routine-plan"
          className="input"
          value={planChoice}
          onChange={(e) => setPlanChoice(e.target.value)}
        >
          <option value="">{t('editor.noneUnassigned')}</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
          <option value={NEW_PLAN}>{t('editor.newPlan')}</option>
        </select>
      </div>
      {planChoice === NEW_PLAN ? (
        <div className="field">
          <label htmlFor="routine-new-plan">{t('editor.newPlanName')}</label>
          <input
            id="routine-new-plan"
            className="input"
            placeholder={t('editor.planNamePlaceholder')}
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
          />
        </div>
      ) : null}

      <div className="section-title">{t('editor.exercises')}</div>
      {items.length === 0 ? (
        <p className="muted">{t('editor.noExercises')}</p>
      ) : (
        <ol className="routine-items">
          {items.map((item, index) => {
            const exercise = exerciseById.get(item.exercise_id)
            const measurement: ExerciseMeasurement = exercise?.measurement ?? 'weight_reps'
            const name = exercise ? displayExerciseName(exercise) : t('editor.unknownExercise')
            const itemBlock = item.block_id
              ? templateBlocks.find((block) => block.id === item.block_id) ?? null
              : null
            const partnerName = (row: TemplateItemInput) => {
              const partner = exerciseById.get(row.exercise_id)
              return partner ? displayExerciseName(partner) : t('editor.unknownExercise')
            }
            const blockPartners = itemBlock?.format === 'superset'
              ? items
                .filter((row) => row.block_id === item.block_id && row !== item)
                .map(partnerName)
              : []
            const legacyPartners = supersetPartners(items, item, partnerName)
            const partners = blockPartners.length > 0 ? blockPartners : legacyPartners
            const notesOpen = Boolean(openNotes[index])
            const isExpanded = expanded.has(index)
            const role = normalizeBlockRole(item.block_role)
            const bodyweightLoad = isBodyweightLoadExercise({
              id: exercise?.id,
              name: exercise?.name,
            })
            const dragging = reorder.active?.from === index
            const dropTarget =
              reorder.active !== null &&
              reorder.active.over === index &&
              reorder.active.from !== index
            return (
              <li
                key={item.id ?? `draft-${index}`}
                ref={reorder.setItemRef(index)}
                className={`exercise-card-item ${blockRoleClass(item.block_role)}${item.superset_group || itemBlock?.format === 'superset' ? ' routine-item--superset' : ''}${isExpanded ? ' routine-item--expanded' : ' routine-item--collapsed'}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
              >
                <div className="exercise-head">
                  <div className="exercise-head__drag" {...reorder.getHandleProps(index)}>
                    <button
                      type="button"
                      className="exercise-grip"
                      aria-label={t('editor.reorder', { name })}
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
                    <button
                      type="button"
                      className="exercise-head__toggle"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? t('editor.collapseNamed', { name }) : t('editor.expandNamed', { name })}
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev)
                          if (next.has(index)) next.delete(index)
                          else next.add(index)
                          return next
                        })
                      }
                    >
                      <strong className="exercise-head__title">{name}</strong>
                    </button>
                  </div>
                  {exercise?.video_url ? (
                    <a
                      href={exercise.video_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="form-link-icon"
                      aria-label={t('editor.watchForm', { name })}
                      title={t('editor.watchForm', { name })}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span aria-hidden="true">▶️</span>
                    </a>
                  ) : null}
                  {isExpanded ? null : (
                    <>
                      <span className={`badge role-chip role-chip--${role} is-selected`}>
                        {blockRoles().find((row) => row.value === role)?.label ?? role}
                      </span>
                      {item.is_warmup ? (
                        <span className="badge badge--planned">{t('workout.warmup')}</span>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn--icon btn--small btn--danger"
                        data-no-drag
                        aria-label={t('editor.removeNamed', { name })}
                        onClick={() => {
                          setItems((prev) => prev.filter((_, i) => i !== index))
                          setExpanded((prev) => {
                            const next = new Set<number>()
                            for (const value of prev) {
                              if (value === index) continue
                              next.add(value > index ? value - 1 : value)
                            }
                            return next
                          })
                        }}
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </>
                  )}
                </div>
                {isExpanded ? (
                <>
                {exercise?.source_url && exercise.source_url !== exercise.video_url ? (
                  <div className="exercise-guide-row">
                    <a
                      href={exercise.source_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="form-link-icon"
                      aria-label={t('editor.openGuide', { name })}
                      title={t('editor.openGuide', { name })}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span aria-hidden="true">📖</span>
                    </a>
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
                {item.block_id ? (
                  <div className="exercise-superset">
                    <span className="badge badge--neutral">
                      {itemBlock ? workoutRoleLabel(itemBlock.role) : t('blockFormat.straight')}
                    </span>
                    <span className="exercise-superset__with">
                      {itemBlock ? blockFormatLabel(itemBlock.format) : ''}
                    </span>
                  </div>
                ) : null}
                <div className="row row--wrap" role="group" aria-label={t('editor.roleFor', { name })}>
                  {blockRoles().map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      className={`btn btn--small role-chip role-chip--${chip.value}${role === chip.value ? ' is-selected' : ''}`}
                      aria-pressed={role === chip.value}
                      onClick={() => update(index, { block_role: chip.value })}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <label className="field field--check">
                  <input
                    type="checkbox"
                    checked={item.is_warmup === true}
                    onChange={(event) => update(index, { is_warmup: event.target.checked })}
                  />
                  <span>{t('editor.warmupExercise')}</span>
                </label>

                <div className="exercise-meta-row">
                  <small className="muted">
                    {exercise ? categoryLabel(exercise.category) : ''} · {MEASUREMENT_LABELS(measurement)}
                  </small>
                  <button
                    type="button"
                    className="btn btn--icon btn--small btn--danger"
                    data-no-drag
                    aria-label={t('editor.removeNamed', { name })}
                    onClick={() => {
                      setItems((prev) => prev.filter((_, i) => i !== index))
                      setExpanded((prev) => {
                        const next = new Set<number>()
                        for (const value of prev) {
                          if (value === index) continue
                          next.add(value > index ? value - 1 : value)
                        }
                        return next
                      })
                    }}
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>

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
                        update(index, {
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
                            update(index, {
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
                          onChange={(e) => update(index, { target_reps_min: e.target.value === '' ? null : Number(e.target.value) })}
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
                      <span>{t('editor.minReps')}</span>
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
                      <span>{t('editor.maxReps')}</span>
                      <input className="input input--cell" type="number" min={0} value={item.target_reps_max ?? item.target_reps ?? ''} onChange={(e) => update(index, { target_reps: e.target.value === '' ? null : Number(e.target.value), target_reps_max: e.target.value === '' ? null : Number(e.target.value) })} />
                    </label>
                    </>
                  ) : null}

                  {measurement === 'weight_distance' ? (
                    <>
                      <label className="field">
                        <span>{t('editor.targetWeight', { unit: weightUnitLabel(units) })}</span>
                        <input className="input input--cell" type="number" min={0} step="0.5" value={weightForInput(item.target_weight_kg, units)} onChange={(e) => update(index, { target_weight_kg: e.target.value === '' ? null : weightToKg(Number(e.target.value), units) })} />
                      </label>
                      <label className="field">
                        <span>{t('editor.minDistance', { unit: distanceUnitLabel(units) })}</span>
                        <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_min_m ?? item.target_distance_m, units)} onChange={(e) => update(index, { target_distance_min_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
                      </label>
                      <label className="field">
                        <span>{t('editor.maxDistance', { unit: distanceUnitLabel(units) })}</span>
                        <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_max_m ?? item.target_distance_m, units)} onChange={(e) => update(index, { target_distance_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units), target_distance_max_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
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
                            update(index, {
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
                            update(index, {
                              target_duration_min_s: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t('editor.maxHold')}</span>
                        <input className="input input--cell" type="number" min={0} value={item.target_duration_max_s ?? item.target_duration_s ?? ''} onChange={(e) => update(index, { target_duration_s: e.target.value === '' ? null : Number(e.target.value), target_duration_max_s: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                    </>
                  ) : null}

                  {measurement === 'duration' || measurement === 'distance_duration' ? (
                    <>
                      <label className="field">
                        <span>{t('editor.minSeconds')}</span>
                        <input className="input input--cell" type="number" min={0} value={item.target_duration_min_s ?? item.target_duration_s ?? ''} onChange={(e) => update(index, { target_duration_min_s: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                      <label className="field">
                        <span>{t('editor.maxSeconds')}</span>
                        <input className="input input--cell" type="number" min={0} value={item.target_duration_max_s ?? item.target_duration_s ?? ''} onChange={(e) => update(index, { target_duration_s: e.target.value === '' ? null : Number(e.target.value), target_duration_max_s: e.target.value === '' ? null : Number(e.target.value) })} />
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
                          update(index, {
                            target_distance_min_m:
                              e.target.value === '' ? null : distanceToM(Number(e.target.value), units),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t('editor.maxDistance', { unit: distanceUnitLabel(units) })}</span>
                      <input className="input input--cell" type="number" min={0} step="0.1" value={distanceForInput(item.target_distance_max_m ?? item.target_distance_m, units)} onChange={(e) => update(index, { target_distance_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units), target_distance_max_m: e.target.value === '' ? null : distanceToM(Number(e.target.value), units) })} />
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
                        update(index, {
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
                        update(index, {
                          rest_seconds: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
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
                          update(index, { ...patch, tempo: structuredTempo(item, patch) })
                        }}
                      />
                    </label>
                  ))}
                  <label className="field">
                    <span>{t('editor.sideMode')}</span>
                    <select className="input input--cell" value={item.side_mode ?? 'bilateral'} onChange={(e) => update(index, { side_mode: e.target.value as NonNullable<TemplateItemInput['side_mode']> })}>
                      <option value="bilateral">{t('editor.bilateral')}</option>
                      <option value="per_side">{t('editor.perSide')}</option>
                      <option value="per_leg">{t('editor.perLeg')}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t('editor.directions')}</span>
                    <input className="input input--cell" type="number" min={1} max={4} value={item.directions ?? 1} onChange={(e) => update(index, { directions: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })} />
                  </label>
                  <label className="field">
                    <span>{t('editor.rpeMin')}</span>
                    <input className="input input--cell" type="number" min={1} max={10} step="0.5" value={item.target_rpe_min ?? ''} onChange={(e) => update(index, { target_rpe_min: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{t('editor.rpeMax')}</span>
                    <input className="input input--cell" type="number" min={1} max={10} step="0.5" value={item.target_rpe_max ?? ''} onChange={(e) => update(index, { target_rpe_max: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{t('editor.rirMin')}</span>
                    <input className="input input--cell" type="number" min={0} max={10} step="0.5" value={item.target_rir_min ?? ''} onChange={(e) => update(index, { target_rir_min: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{t('editor.rirMax')}</span>
                    <input className="input input--cell" type="number" min={0} max={10} step="0.5" value={item.target_rir_max ?? ''} onChange={(e) => update(index, { target_rir_max: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{t('editor.loadIncrement')}</span>
                    <input className="input input--cell" type="number" min={0} step="0.5" value={item.load_increment_kg ?? ''} onChange={(e) => update(index, { load_increment_kg: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{t('editor.tempoIntent')}</span>
                    <select className="input input--cell" value={item.tempo_intent ?? 'controlled'} onChange={(e) => {
                      const patch = { tempo_intent: e.target.value as 'controlled' | 'explosive' }
                      update(index, { ...patch, tempo: structuredTempo(item, patch) })
                    }}>
                      <option value="controlled">{t('editor.controlled')}</option>
                      <option value="explosive">{t('editor.explosive')}</option>
                    </select>
                  </label>
                </div>

                <NotesDisclosure
                  label={item.notes ? t('editor.notesItem') : t('editor.addNotes')}
                  preview={item.notes}
                  open={notesOpen}
                  filled={Boolean(item.notes)}
                  onToggle={() =>
                    setOpenNotes((prev) => ({ ...prev, [index]: !prev[index] }))
                  }
                  panelId={`routine-notes-${item.id ?? index}`}
                >
                  <label className="field">
                    <span className="visually-hidden">{t('editor.notesItem')}</span>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder={t('editor.notesPlaceholder')}
                      value={item.notes ?? ''}
                      onChange={(e) =>
                        update(index, { notes: e.target.value === '' ? null : e.target.value })
                      }
                    />
                  </label>
                </NotesDisclosure>

                {itemBlock ? (
                  <small className="muted">{t('editor.groupingV2')}</small>
                ) : (
                  <button
                    type="button"
                    className={`btn btn--small ${item.superset_group ? 'btn--accent' : ''}`}
                    aria-pressed={Boolean(item.superset_group)}
                    onClick={() => toggleSuperset(index)}
                  >
                    {item.superset_group ? t('editor.inSuperset') : t('editor.supersetNext')}
                  </button>
                )}
                </>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>

      <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={() => setPickerOpen(true)}>
        <IconPlus width={18} height={18} /> {t('editor.addExercise')}
      </button>

      {error ? (
        <p className="field-error" role="alert" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}

      <div className="row row--wrap" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy}>
          {busy ? t('common.saving') : t('editor.saveRoutine')}
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
                      caught instanceof Error ? caught.message : t('errors.exportRoutine'),
                    )
                  })
              }}
            >
              {t('routines.export')}
            </button>
            <button type="button" className="btn btn--danger" onClick={() => void removeRoutine()}>
              {t('common.delete')}
            </button>
          </>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={() => void navigate('/routines')}>
          {t('common.back')}
        </button>
      </div>

      {pickerOpen ? (
        <Modal title={t('editor.addToRoutine')} onClose={() => setPickerOpen(false)}>
          <ExercisePicker
            warmupOption
            onClose={() => setPickerOpen(false)}
            onSelect={(exerciseId, options) => {
              const nextIndex = items.length
              setItems((prev) => [...prev, newItem(exerciseId, prev.length, options?.isWarmup === true)])
              setExpanded((keys) => new Set(keys).add(nextIndex))
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}

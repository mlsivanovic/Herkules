// Routine editor: compact exercise list with a per-exercise bottom sheet,
// planned sets, targets, rest, notes and superset/circuit grouping.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore, newId, type TemplateItemInput } from '../lib/store'
import type { ExerciseMeasurement } from '../types/db'
import { EmptyState, Modal } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'
import { ExerciseItemSheet } from '../components/ExerciseItemSheet'
import { validateRequiredName } from '../lib/validation'
import { blockRoles, blockRoleClass, normalizeBlockRole } from '../lib/blockRole'
import {
  blockFormatLabel,
  displayExerciseName,
  useT,
  workoutRoleLabel,
} from '../lib/i18n'
import { moveIndex, supersetPartners, toggleSupersetWithNext } from '../lib/reorder'
import { usePointerReorder } from '../lib/usePointerReorder'
import { summarizePlannedItem } from '../lib/routineSummary'
import {
  IconChevronDown,
  IconGrip,
  IconMore,
  IconPencil,
  IconPlus,
  IconTrash,
} from '../components/Icons'
import { isPoolTemplate, templatePlanIds } from '../lib/programs/plans'
import { isBodyweightLoadExercise } from '../lib/bodyweightLoad'
import { formVideoUrl } from '../lib/video'
import { downloadTextFile, routinesExportFilename } from '../lib/routinesIo'
import './routineEditor.css'

function newItem(exerciseId: string, position: number, isWarmup = false): TemplateItemInput {
  return {
    id: null,
    exercise_id: exerciseId,
    backup_exercise_id: null,
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

const NEW_PLAN = '__new__'

export interface MenuItem {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect(): void
}

/** Small anchored popover menu in the Material overflow-menu style. */
function OverflowMenu({ label, items, onClose }: { label: string; items: MenuItem[]; onClose(): void }) {
  const popRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    popRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="menu-backdrop" onPointerDown={onClose} aria-hidden="true" />
      <div ref={popRef} className="menu-pop" data-no-drag role="menu" aria-label={label}>
        {items.map((menuItem) => (
          <button
            key={menuItem.key}
            type="button"
            role="menuitem"
            className={`menu-pop__item${menuItem.danger ? ' menu-pop__item--danger' : ''}`}
            disabled={menuItem.disabled}
            onClick={() => {
              menuItem.onSelect()
              onClose()
            }}
          >
            {menuItem.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function RoutineEditor() {
  const { t, locale } = useT()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const store = useStore()
  const { templates, templateItems, templateBlocks, exercises, plans, planRoutines, ready } = store

  const template = isNew ? null : templates.find((t) => t.id === id) ?? null
  const pool = template ? isPoolTemplate(template) : true
  const locked = template?.locked === true
  const units = store.profile?.unit_system ?? 'metric'
  const queryPlan = searchParams.get('plan')

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [planChoice, setPlanChoice] = useState(queryPlan ?? '')
  const [newPlanName, setNewPlanName] = useState('')
  const [items, setItems] = useState<TemplateItemInput[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [backupPickerIndex, setBackupPickerIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(queryPlan ? [queryPlan] : [])
  const [announce, setAnnounce] = useState('')
  const [sheetIndex, setSheetIndex] = useState<number | null>(null)
  const [barMenuOpen, setBarMenuOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(isNew)
  const reopenSheetRef = useRef(false)

  useEffect(() => {
    if (template && loadedFor !== template.id) {
      setName(template.name)
      setNotes(template.notes ?? '')
      setPlanChoice(template.plan_id ?? '')
      setSelectedPlanIds(templatePlanIds(template.id, planRoutines, template.plan_id))
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
      setSheetIndex(null)
      setDetailsOpen(false)
      setLoadedFor(template.id)
    }
  }, [template, templateItems, templateBlocks, planRoutines, loadedFor])

  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const moveTo = useCallback((from: number, to: number) => {
    setItems((prev) => moveIndex(prev, from, to))
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

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setSheetIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
  }

  /** Toggle superset grouping with the next item. Items inside a structured
   * (V2) block are detached from a grouped block so the pair takes effect. */
  function toggleSuperset(index: number) {
    const groupedBlockIds = new Set(
      templateBlocks.filter((block) => block.format !== 'straight').map((block) => block.id),
    )
    setItems((prev) => toggleSupersetWithNext(prev, index, groupedBlockIds, newId))
  }

  function openBackupPicker(index: number, fromSheet: boolean) {
    // The picker is a modal: close the sheet first so the two overlays
    // never stack, then reopen it when the picker closes.
    reopenSheetRef.current = fromSheet
    if (fromSheet) setSheetIndex(null)
    setBackupPickerIndex(index)
  }

  function closeBackupPicker() {
    const pickedFor = backupPickerIndex
    setBackupPickerIndex(null)
    if (reopenSheetRef.current && pickedFor !== null) {
      setSheetIndex(pickedFor)
    }
    reopenSheetRef.current = false
  }

  function describeItem(index: number) {
    const item = items[index]
    if (!item) return null
    const exercise = exerciseById.get(item.exercise_id)
    const measurement: ExerciseMeasurement = exercise?.measurement ?? 'weight_reps'
    const itemName = exercise ? displayExerciseName(exercise) : t('editor.unknownExercise')
    const backupExercise = item.backup_exercise_id
      ? exerciseById.get(item.backup_exercise_id)
      : null
    const backupName = backupExercise ? displayExerciseName(backupExercise) : null
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
    const role = normalizeBlockRole(item.block_role)
    return {
      item,
      name: itemName,
      summary: summarizePlannedItem(item, measurement, units, locale),
      exercise,
      backupName,
      partners,
      role,
      grouped: Boolean(item.superset_group) || itemBlock?.format === 'superset',
      supersetActive: partners.length > 0,
      canSupersetNext: index < items.length - 1,
      blockBadge: itemBlock ? workoutRoleLabel(itemBlock.role) : null,
      blockFormat: itemBlock ? blockFormatLabel(itemBlock.format) : '',
      videoHref: formVideoUrl(exercise?.name),
      bodyweightLoad: isBodyweightLoadExercise({ id: exercise?.id, name: exercise?.name }),
    }
  }

  const sheet = sheetIndex !== null ? describeItem(sheetIndex) : null

  const detailsHint = (() => {
    const firstLine = notes.trim().split('\n')[0]
    if (firstLine) return firstLine
    if (!isNew && pool) {
      const names = selectedPlanIds
        .map((planId) => plans.find((plan) => plan.id === planId)?.name)
        .filter((value): value is string => Boolean(value))
      return names.length > 0 ? names.join(', ') : t('editor.noneUnassigned')
    }
    if (planChoice === NEW_PLAN) return newPlanName.trim() || t('editor.newPlan')
    return plans.find((plan) => plan.id === planChoice)?.name ?? t('editor.noneUnassigned')
  })()

  async function save() {
    const validation = validateRequiredName(name, t('editor.routineName'))
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      let createdPlanId: string | null = null
      if (planChoice === NEW_PLAN) {
        const planValidation = validateRequiredName(newPlanName, t('editor.planName'))
        if (planValidation) {
          setError(planValidation)
          setBusy(false)
          return
        }
        const createdPlan = await store.createPlan(newPlanName.trim(), null)
        createdPlanId = createdPlan.id
      }

      const targetPlanIds = pool
        ? [
            ...new Set([
              ...selectedPlanIds.filter((value) => value !== '' && value !== NEW_PLAN),
              ...(createdPlanId ? [createdPlanId] : []),
              ...(isNew && planChoice !== '' && planChoice !== NEW_PLAN ? [planChoice] : []),
            ]),
          ]
        : [createdPlanId ?? (planChoice === '' || planChoice === NEW_PLAN ? null : planChoice)]

      let templateId: string
      if (isNew) {
        const created = await store.createTemplate(
          name.trim(),
          notes.trim() === '' ? null : notes.trim(),
          null,
        )
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

      if (pool) {
        const current = new Set(templatePlanIds(templateId, store.planRoutines, template?.plan_id))
        for (const planId of targetPlanIds) {
          if (!planId || current.has(planId)) continue
          await store.assignTemplateToPlan(templateId, planId)
        }
        for (const planId of current) {
          if (!targetPlanIds.includes(planId)) {
            await store.removeTemplateFromPlan(templateId, planId)
          }
        }
      } else {
        const assignedPlanId = targetPlanIds[0] ?? null
        if ((template?.plan_id ?? null) !== assignedPlanId) {
          await store.assignTemplateToPlan(templateId, assignedPlanId)
        }
      }

      await store.saveTemplateItems(
        templateId,
        items.map((item, index) => ({ ...item, position: index })),
      )
      const goPlan = pool
        ? (createdPlanId ?? selectedPlanIds[0] ?? (planChoice && planChoice !== NEW_PLAN ? planChoice : null))
        : (targetPlanIds[0] ?? null)
      void navigate(goPlan ? `/plans/${goPlan}` : '/routines')
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

  function copyRoutine() {
    if (!template) return
    void store
      .cloneTemplate(template.id)
      .then((copy) => {
        void navigate(`/routines/${copy.id}`)
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : t('errors.copyRoutine'))
      })
  }

  function exportRoutine() {
    if (!template) return
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
  }

  const barMenuItems: MenuItem[] = template
    ? [
        ...(locked
          ? []
          : [
              {
                key: 'copy',
                label: t('editor.copyRoutine'),
                onSelect: copyRoutine,
              } as MenuItem,
            ]),
        {
          key: 'export',
          label: t('routines.export'),
          onSelect: exportRoutine,
        },
        {
          key: 'delete',
          label: t('common.delete'),
          danger: true,
          onSelect: () => void removeRoutine(),
        },
        {
          key: 'back',
          label: t('common.back'),
          onSelect: () => void navigate('/routines'),
        },
      ]
    : [
        {
          key: 'back',
          label: t('common.back'),
          onSelect: () => void navigate('/routines'),
        },
      ]

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

      <div className="advanced-block routine-details">
        <button
          type="button"
          className="advanced-toggle"
          aria-expanded={detailsOpen}
          aria-controls="routine-details-body"
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span className="advanced-toggle__label">{t('editor.details')}</span>
          <span className="muted advanced-toggle__hint">{detailsHint}</span>
          <IconChevronDown className="advanced-toggle__chevron" width={14} height={14} />
        </button>
        {detailsOpen ? (
          <div className="routine-details__body" id="routine-details-body">
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
            {!isNew && pool ? (
              <fieldset className="field">
                <legend>{t('editor.usedInPlans')}</legend>
                <p className="muted" style={{ margin: '0 0 0.45rem' }}>
                  {t('editor.poolPlansHint')}
                </p>
                <div className="stack">
                  {plans.map((plan) => (
                    <label key={plan.id} className="field field--check">
                      <input
                        type="checkbox"
                        checked={selectedPlanIds.includes(plan.id)}
                        onChange={(event) => {
                          setSelectedPlanIds((prev) =>
                            event.target.checked
                              ? [...prev, plan.id]
                              : prev.filter((value) => value !== plan.id),
                          )
                        }}
                      />
                      <span>{plan.name}</span>
                    </label>
                  ))}
                  <label className="field field--check">
                    <input
                      type="checkbox"
                      checked={planChoice === NEW_PLAN}
                      onChange={(event) => setPlanChoice(event.target.checked ? NEW_PLAN : '')}
                    />
                    <span>{t('editor.newPlan')}</span>
                  </label>
                </div>
              </fieldset>
            ) : (
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
            )}
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
          </div>
        ) : null}
      </div>

      <div className="section-title">{t('editor.exercises')}</div>
      {items.length === 0 ? (
        <>
          <p className="muted">{t('editor.noExercises')}</p>
          <button type="button" className="btn btn--block" onClick={() => setPickerOpen(true)}>
            <IconPlus width={18} height={18} /> {t('editor.addExercise')}
          </button>
        </>
      ) : (
        <ol className="routine-items">
          {items.map((item, index) => {
            const described = describeItem(index)
            if (!described) return null
            const dragging = reorder.active?.from === index
            const dropTarget =
              reorder.active !== null &&
              reorder.active.over === index &&
              reorder.active.from !== index
            return (
              <li
                key={item.id ?? `draft-${index}`}
                ref={reorder.setItemRef(index)}
                className={`exercise-card-item routine-row ${blockRoleClass(item.block_role)}${described.grouped ? ' routine-row--superset' : ''}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
              >
                <div className="routine-row__top" {...reorder.getHandleProps(index)}>
                  <button
                    type="button"
                    className="exercise-grip"
                    aria-label={t('editor.reorder', { name: described.name })}
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
                    className="routine-row__main"
                    aria-label={t('editor.editExercise', { name: described.name })}
                    onClick={() => setSheetIndex(index)}
                  >
                    <strong className="routine-row__title">{described.name}</strong>
                    <span className="routine-row__meta">{described.summary}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon btn--ghost routine-row__action-btn"
                    data-no-drag
                    aria-label={t('editor.editExercise', { name: described.name })}
                    title={t('editor.editAction')}
                    onClick={() => setSheetIndex(index)}
                  >
                    <IconPencil width={18} height={18} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon btn--ghost routine-row__action-btn routine-row__delete-btn"
                    data-no-drag
                    aria-label={t('editor.removeNamed', { name: described.name })}
                    title={t('editor.removeExercise')}
                    onClick={() => removeItem(index)}
                  >
                    <IconTrash width={18} height={18} />
                  </button>
                </div>
                <div className="routine-row__tags">
                  <span className={`badge role-chip role-chip--${described.role} is-selected`}>
                    {blockRoles().find((row) => row.value === described.role)?.label ?? described.role}
                  </span>
                  {item.is_warmup ? (
                    <span className="badge badge--planned">{t('workout.warmup')}</span>
                  ) : null}
                  {described.grouped ? (
                    <span className="badge badge--in-progress">{t('blockFormat.superset')}</span>
                  ) : null}
                  {described.backupName ? (
                    <span className="badge badge--neutral routine-row__backup">
                      {t('editor.shortBackupBadge', { name: described.backupName })}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>

      {error ? (
        <p className="field-error" role="alert" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}

      {locked ? <p className="muted">{t('errors.assignedReadOnly')}</p> : null}
      <div className="editor-bar">
        <button
          type="button"
          className="btn btn--primary editor-bar__save"
          onClick={() => void save()}
          disabled={busy || locked}
        >
          {busy ? t('common.saving') : t('editor.saveRoutine')}
        </button>
        <button
          type="button"
          className="btn editor-bar__add"
          onClick={() => setPickerOpen(true)}
          aria-label={t('editor.addExercise')}
          title={t('editor.addExercise')}
        >
          <IconPlus width={18} height={18} />
          <span className="editor-bar__add-label">{t('editor.addExercise')}</span>
        </button>
        <div className="editor-bar__menu">
          <button
            type="button"
            className="btn btn--icon"
            aria-label={t('editor.routineOptions')}
            aria-expanded={barMenuOpen}
            aria-haspopup="menu"
            onClick={() => setBarMenuOpen((open) => !open)}
          >
            <IconMore width={20} height={20} />
          </button>
          {barMenuOpen ? (
            <OverflowMenu
              label={t('editor.routineOptions')}
              items={barMenuItems}
              onClose={() => setBarMenuOpen(false)}
            />
          ) : null}
        </div>
      </div>

      {pickerOpen ? (
        <Modal title={t('editor.addToRoutine')} onClose={() => setPickerOpen(false)}>
          <ExercisePicker
            warmupOption
            onClose={() => setPickerOpen(false)}
            onSelect={(exerciseId, options) => {
              const nextIndex = items.length
              setItems((prev) => [...prev, newItem(exerciseId, prev.length, options?.isWarmup === true)])
              setSheetIndex(nextIndex)
            }}
          />
        </Modal>
      ) : null}

      {sheet && sheetIndex !== null ? (
        <ExerciseItemSheet
          item={sheet.item}
          name={sheet.name}
          summary={sheet.summary}
          exercise={sheet.exercise}
          backupName={sheet.backupName}
          partners={sheet.partners}
          blockBadge={sheet.blockBadge}
          blockFormat={sheet.blockFormat}
          supersetActive={sheet.supersetActive}
          canSupersetNext={sheet.canSupersetNext}
          units={units}
          videoHref={sheet.videoHref}
          bodyweightLoad={sheet.bodyweightLoad}
          onPatch={(patch) => update(sheetIndex, patch)}
          onToggleSuperset={() => toggleSuperset(sheetIndex)}
          onPickBackup={() => openBackupPicker(sheetIndex, true)}
          onClearBackup={() => update(sheetIndex, { backup_exercise_id: null })}
          onRemove={() => removeItem(sheetIndex)}
          onClose={() => setSheetIndex(null)}
        />
      ) : null}

      {backupPickerIndex !== null && items[backupPickerIndex] ? (
        <ExercisePicker
          title={t('editor.chooseBackupExercise')}
          excludeIds={[items[backupPickerIndex].exercise_id]}
          onClose={closeBackupPicker}
          onSelect={(exerciseId) => {
            update(backupPickerIndex, { backup_exercise_id: exerciseId })
          }}
        />
      ) : null}
    </div>
  )
}

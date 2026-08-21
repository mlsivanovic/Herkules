// Training plan editor: name, notes, ordered routines, rotation scheduler.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { EmptyState, Modal } from '../components/ui'
import { IconGrip, IconPlus, IconTrash } from '../components/Icons'
import { PlanRotationModal } from '../components/PlanRotationModal'
import { validateRequiredName } from '../lib/validation'
import { moveIndex } from '../lib/reorder'
import { usePointerReorder } from '../lib/usePointerReorder'
import { sortPlanTemplates, unassignedTemplates } from '../lib/programs/plans'
import { useT } from '../lib/i18n'
import './planEditor.css'
import './routineEditor.css'

export function PlanEditor() {
  const { t } = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const store = useStore()
  const { plans, templates, templateItems, ready, reorderPlanDays } = store

  const plan = isNew ? null : plans.find((row) => row.id === id) ?? null
  const members = useMemo(
    () => (plan ? sortPlanTemplates(templates, plan.id) : []),
    [plan, templates],
  )

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [rotationOpen, setRotationOpen] = useState(false)

  useEffect(() => {
    if (plan && loadedFor !== plan.id) {
      setName(plan.name)
      setNotes(plan.notes ?? '')
      setLoadedFor(plan.id)
    }
  }, [plan, loadedFor])

  const moveTo = useCallback(
    (from: number, to: number) => {
      if (!plan) return
      const ordered = moveIndex(members, from, to).map((row) => row.id)
      void reorderPlanDays(plan.id, ordered)
    },
    [members, plan, reorderPlanDays],
  )

  const reorder = usePointerReorder({
    itemCount: members.length,
    onMove: moveTo,
    announce: setAnnounce,
  })

  const addable = useMemo(() => {
    if (!plan) return templates
    return templates.filter((row) => row.plan_id !== plan.id)
  }, [templates, plan])

  if (ready && !isNew && !plan) {
    return <EmptyState title={t('errors.planNotFound')} hint={t('common.mayHaveDeleted')} />
  }

  async function save() {
    const validation = validateRequiredName(name, t('editor.planName'))
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const trimmedNotes = notes.trim() === '' ? null : notes.trim()
      if (isNew) {
        const created = await store.createPlan(name.trim(), trimmedNotes)
        void navigate(`/plans/${created.id}`, { replace: true })
      } else if (plan) {
        await store.updatePlan(plan.id, { name: name.trim(), notes: trimmedNotes })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.savePlan'))
    } finally {
      setBusy(false)
    }
  }

  async function removePlan() {
    if (!plan) return
    if (
      window.confirm(t('editor.deletePlanConfirm', { name: plan.name }))
    ) {
      try {
        await store.deletePlan(plan.id)
        void navigate('/routines')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('errors.deletePlan'))
      }
    }
  }

  async function addRoutine(templateId: string) {
    const other = templates.find((row) => row.id === templateId)
    if (other?.plan_id && other.plan_id !== plan?.id) {
      const current = plans.find((row) => row.id === other.plan_id)
      if (
        !window.confirm(
          current
            ? t('editor.moveHere', { name: other.name, plan: current.name })
            : t('editor.moveHereUnknown', { name: other.name }),
        )
      ) {
        return
      }
    }
    if (!plan) return
    try {
      await store.assignTemplateToPlan(templateId, plan.id)
      setPickerOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.addRoutine'))
    }
  }

  async function removeRoutine(templateId: string) {
    try {
      await store.assignTemplateToPlan(templateId, null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.removeRoutine'))
    }
  }

  function newRoutine() {
    if (!plan) return
    void navigate(`/routines/new?plan=${plan.id}`)
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isNew ? t('editor.newPlanTitle') : t('editor.editPlanTitle')}</h1>
      </div>

      <div className="field">
        <label htmlFor="plan-name">{t('editor.nameLabel')}</label>
        <input
          id="plan-name"
          className="input"
          placeholder={t('editor.planNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="plan-notes">{t('editor.notes')}</label>
        <textarea
          id="plan-notes"
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!isNew && plan ? (
        <>
          <div className="section-title">{t('nav.routines')}</div>
          {members.length === 0 ? (
            <p className="muted">{t('editor.noRoutinesYet')}</p>
          ) : (
            <ol className="plan-days">
              {members.map((template, index) => {
                const count = templateItems.filter((item) => item.template_id === template.id).length
                const dragging = reorder.active?.from === index
                const dropTarget =
                  reorder.active !== null &&
                  reorder.active.over === index &&
                  reorder.active.from !== index
                return (
                  <li
                    key={template.id}
                    ref={reorder.setItemRef(index)}
                    className={`card plan-day${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
                  >
                    <div className="plan-day__grip" {...reorder.getHandleProps(index)}>
                      <button
                        type="button"
                        className="exercise-grip"
                        aria-label={t('editor.reorder', { name: template.name })}
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
                    </div>
                    <button
                      type="button"
                      className="plan-day__main"
                      onClick={() => void navigate(`/routines/${template.id}`)}
                    >
                      <span className="plan-day__index">{t('editor.dayN', { n: index + 1 })}</span>
                      <strong>{template.name}</strong>
                      <small className="muted">
                        {count === 1
                          ? t('routines.exerciseOne', { count })
                          : t('routines.exerciseCount', { count })}
                      </small>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      aria-label={t('editor.removeFromPlan', { name: template.name })}
                      onClick={() => void removeRoutine(template.id)}
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="row row--wrap" style={{ marginTop: '0.85rem' }}>
            <button type="button" className="btn" onClick={() => setPickerOpen(true)}>
              {t('editor.addExisting')}
            </button>
            <button type="button" className="btn" onClick={newRoutine}>
              <IconPlus width={16} height={16} /> {t('routines.newRoutine')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={members.length === 0}
              onClick={() => setRotationOpen(true)}
            >
              {t('routines.planRotation')}
            </button>
          </div>
        </>
      ) : (
        <p className="muted">{t('editor.saveFirst')}</p>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="visually-hidden" aria-live="polite">
        {announce}
      </div>

      <div className="row row--wrap" style={{ marginTop: '1.1rem' }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {busy ? t('common.saving') : t('editor.savePlan')}
        </button>
        <button type="button" className="btn" onClick={() => void navigate('/routines')}>
          {t('common.back')}
        </button>
        {plan ? (
          <button type="button" className="btn btn--ghost" onClick={() => void removePlan()}>
            {t('common.delete')}
          </button>
        ) : null}
      </div>

      {pickerOpen ? (
        <Modal title={t('editor.addToPlan')} onClose={() => setPickerOpen(false)}>
          {addable.length === 0 ? (
            <EmptyState
              title={t('editor.noOtherRoutines')}
              hint={t('editor.noOtherRoutinesHint')}
            />
          ) : (
            <ul className="plan-picker">
              {unassignedTemplates(addable).map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className="card exercise-card"
                    onClick={() => void addRoutine(template.id)}
                  >
                    <strong>{template.name}</strong>
                    <small className="muted">{t('editor.unassignedBadge')}</small>
                  </button>
                </li>
              ))}
              {addable
                .filter((row) => row.plan_id)
                .map((template) => {
                  const other = plans.find((row) => row.id === template.plan_id)
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        className="card exercise-card"
                        onClick={() => void addRoutine(template.id)}
                      >
                        <strong>{template.name}</strong>
                        <small className="muted">
                          {other
                            ? t('editor.inOtherPlan', { name: other.name })
                            : t('editor.inAnotherPlan')}
                        </small>
                      </button>
                    </li>
                  )
                })}
            </ul>
          )}
        </Modal>
      ) : null}

      {rotationOpen && plan ? (
        <PlanRotationModal planId={plan.id} onClose={() => setRotationOpen(false)} />
      ) : null}
    </div>
  )
}

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
import './planEditor.css'
import './routineEditor.css'

export function PlanEditor() {
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
    return <EmptyState title="Plan not found" hint="It may have been deleted." />
  }

  async function save() {
    const validation = validateRequiredName(name, 'Plan name')
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
      setError(caught instanceof Error ? caught.message : 'Could not save the plan.')
    } finally {
      setBusy(false)
    }
  }

  async function removePlan() {
    if (!plan) return
    if (
      window.confirm(
        `Delete plan "${plan.name}"? Routines stay in your library; they just become unassigned.`,
      )
    ) {
      try {
        await store.deletePlan(plan.id)
        void navigate('/routines')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not delete the plan.')
      }
    }
  }

  async function addRoutine(templateId: string) {
    const other = templates.find((row) => row.id === templateId)
    if (other?.plan_id && other.plan_id !== plan?.id) {
      const current = plans.find((row) => row.id === other.plan_id)
      if (
        !window.confirm(
          `"${other.name}" is in ${current?.name ?? 'another plan'}. Move it here?`,
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
      setError(caught instanceof Error ? caught.message : 'Could not add that routine.')
    }
  }

  async function removeRoutine(templateId: string) {
    try {
      await store.assignTemplateToPlan(templateId, null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove that routine.')
    }
  }

  function newRoutine() {
    if (!plan) return
    void navigate(`/routines/new?plan=${plan.id}`)
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isNew ? 'New plan' : 'Edit plan'}</h1>
      </div>

      <div className="field">
        <label htmlFor="plan-name">Name</label>
        <input
          id="plan-name"
          className="input"
          placeholder="e.g. Push / Pull / Legs"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="plan-notes">Notes (optional)</label>
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
          <div className="section-title">Routines</div>
          {members.length === 0 ? (
            <p className="muted">No routines yet — add existing ones or create a new day.</p>
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
                        aria-label={`Reorder ${template.name}`}
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
                      <span className="plan-day__index">Day {index + 1}</span>
                      <strong>{template.name}</strong>
                      <small className="muted">
                        {count} exercise{count === 1 ? '' : 's'}
                      </small>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      aria-label={`Remove ${template.name} from plan`}
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
              Add existing
            </button>
            <button type="button" className="btn" onClick={newRoutine}>
              <IconPlus width={16} height={16} /> New routine
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={members.length === 0}
              onClick={() => setRotationOpen(true)}
            >
              Plan rotation
            </button>
          </div>
        </>
      ) : (
        <p className="muted">Save the plan first, then add routines.</p>
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
          {busy ? 'Saving…' : 'Save plan'}
        </button>
        <button type="button" className="btn" onClick={() => void navigate('/routines')}>
          Back
        </button>
        {plan ? (
          <button type="button" className="btn btn--ghost" onClick={() => void removePlan()}>
            Delete
          </button>
        ) : null}
      </div>

      {pickerOpen ? (
        <Modal title="Add routine to plan" onClose={() => setPickerOpen(false)}>
          {addable.length === 0 ? (
            <EmptyState
              title="No other routines"
              hint="Create a new routine for this plan, or unassign one from another plan."
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
                    <small className="muted">Unassigned</small>
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
                        <small className="muted">In {other?.name ?? 'another plan'}</small>
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

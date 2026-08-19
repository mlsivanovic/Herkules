// Routines list: training plans, unassigned templates, Hybrid 4-day starter.
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { EmptyState, Loader } from '../components/ui'
import { IconPlus } from '../components/Icons'
import { PlanRotationModal } from '../components/PlanRotationModal'
import {
  downloadTextFile,
  formatRoutineImportMessage,
  routinesExportFilename,
} from '../lib/routinesIo'
import { isHybridProgramInstalled } from '../lib/programs/hybrid4day'
import { hybridPlanFrom, sortPlanTemplates, unassignedTemplates } from '../lib/programs/plans'
import './routines.css'

export function Routines() {
  const {
    plans,
    templates,
    templateItems,
    ready,
    installHybridProgram,
    exportRoutines,
    importRoutines,
  } = useStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plannerPlanId, setPlannerPlanId] = useState<string | null>(null)
  const [ioBusy, setIoBusy] = useState(false)
  const [ioMessage, setIoMessage] = useState<string | null>(null)
  const [ioError, setIoError] = useState<string | null>(null)

  const installed = useMemo(() => isHybridProgramInstalled(templates), [templates])
  const hybridPlan = useMemo(() => hybridPlanFrom(plans), [plans])
  const loose = useMemo(() => unassignedTemplates(templates), [templates])

  async function addProgram() {
    setBusy(true)
    setError(null)
    try {
      const result = await installHybridProgram()
      if (result.created) setPlannerPlanId(result.planId)
      else void navigate(`/plans/${result.planId}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the program.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <Loader />

  return (
    <div>
      <div className="page-head">
        <h1>Routines</h1>
        <div className="row row--wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setIoBusy(true)
              setIoError(null)
              setIoMessage(null)
              void file
                .text()
                .then((text) => importRoutines(text))
                .then((result) => {
                  setIoMessage(formatRoutineImportMessage(result))
                })
                .catch((caught: unknown) => {
                  setIoError(caught instanceof Error ? caught.message : 'Could not import that file.')
                })
                .finally(() => setIoBusy(false))
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={ioBusy}
            onClick={() => fileRef.current?.click()}
          >
            {ioBusy ? 'Importing…' : 'Import'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={ioBusy || templates.length === 0}
            onClick={() => {
              setIoBusy(true)
              setIoError(null)
              setIoMessage(null)
              void exportRoutines()
                .then((json) => {
                  downloadTextFile(routinesExportFilename(), json, 'application/json')
                  setIoMessage(`Exported ${templates.length} routine${templates.length === 1 ? '' : 's'}.`)
                })
                .catch((caught: unknown) => {
                  setIoError(caught instanceof Error ? caught.message : 'Could not export routines.')
                })
                .finally(() => setIoBusy(false))
            }}
          >
            Export
          </button>
          <button type="button" className="btn" onClick={() => void navigate('/plans/new')}>
            New plan
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void navigate('/routines/new')}
          >
            <IconPlus width={18} height={18} /> New routine
          </button>
        </div>
      </div>
      {ioMessage || ioError ? (
        <div className="stack" style={{ marginBottom: '0.9rem' }}>
          {ioMessage ? <small className="badge badge--completed">{ioMessage}</small> : null}
          {ioError ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {ioError}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="card starter-card">
        <div className="starter-card__head">
          <strong>Hybrid 4-day</strong>
          <span className="badge badge--neutral">Starter</span>
        </div>
        <p className="muted starter-card__blurb">
          Health, strength, function, and tendon work. Four days (A–D), ~65–80 min, mostly RPE 7–8.
          Adds a training plan with four editable routines — coaching notes are defaults you can change.
        </p>
        <div className="row row--wrap">
          {installed && hybridPlan ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void navigate(`/plans/${hybridPlan.id}`)}
              >
                Open plan
              </button>
              <button type="button" className="btn" onClick={() => setPlannerPlanId(hybridPlan.id)}>
                Plan rotation
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void addProgram()}>
              {busy ? 'Adding…' : 'Add Hybrid 4-day'}
            </button>
          )}
          {installed && hybridPlan ? <span className="muted">Already in your library</span> : null}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <div className="section-title">Training plans</div>
      {plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          hint="A plan is an ordered set of routines — a split like PPL or Hybrid 4-day."
          action={
            <button type="button" className="btn btn--primary" onClick={() => void navigate('/plans/new')}>
              Create a plan
            </button>
          }
        />
      ) : (
        <ul className="exercise-list">
          {plans.map((plan) => {
            const days = sortPlanTemplates(templates, plan.id)
            return (
              <li key={plan.id}>
                <button
                  type="button"
                  className="card exercise-card"
                  onClick={() => void navigate(`/plans/${plan.id}`)}
                >
                  <span className="row row--between">
                    <strong>{plan.name}</strong>
                    <span className="badge badge--neutral">
                      {days.length} day{days.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  {days.length > 0 ? (
                    <small className="muted">
                      {days.map((day) => day.name.replace(/^Hybrid [ABCD] — /u, '')).join(' · ')}
                    </small>
                  ) : plan.notes ? (
                    <small className="muted">{previewNotes(plan.notes)}</small>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="section-title">Unassigned routines</div>
      {loose.length === 0 ? (
        <EmptyState
          title={templates.length === 0 ? 'No routines yet' : 'Every routine is in a plan'}
          hint="A routine is a reusable list of exercises you can schedule or start directly."
          action={
            templates.length === 0 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void navigate('/routines/new')}
              >
                Create your first routine
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="exercise-list">
          {loose.map((template) => {
            const items = templateItems.filter((i) => i.template_id === template.id)
            return (
              <li key={template.id}>
                <button
                  type="button"
                  className="card exercise-card"
                  onClick={() => void navigate(`/routines/${template.id}`)}
                >
                  <span className="row row--between">
                    <strong>{template.name}</strong>
                    <span className="badge badge--neutral">{items.length} exercises</span>
                  </span>
                  {template.notes ? (
                    <small className="muted">{previewNotes(template.notes)}</small>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {plannerPlanId ? (
        <PlanRotationModal planId={plannerPlanId} onClose={() => setPlannerPlanId(null)} />
      ) : null}
    </div>
  )
}

function previewNotes(notes: string): string {
  return notes.replace(/^Program: Hybrid 4-day [ABCD]\s*/u, '').trim()
}

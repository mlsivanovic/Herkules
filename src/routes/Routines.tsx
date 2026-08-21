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
import { useT } from '../lib/i18n'
import './routines.css'

export function Routines() {
  const { t } = useT()
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
      setError(caught instanceof Error ? caught.message : t('errors.addProgram'))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <Loader />

  return (
    <div>
      <div className="page-head">
        <h1>{t('routines.title')}</h1>
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
                  setIoError(caught instanceof Error ? caught.message : t('errors.importFile'))
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
            {ioBusy ? t('routines.importing') : t('routines.import')}
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
                  setIoMessage(
                    templates.length === 1
                      ? t('routines.exportedOne', { count: templates.length })
                      : t('routines.exportedOther', { count: templates.length }),
                  )
                })
                .catch((caught: unknown) => {
                  setIoError(caught instanceof Error ? caught.message : t('errors.exportRoutines'))
                })
                .finally(() => setIoBusy(false))
            }}
          >
            {t('routines.export')}
          </button>
          <button type="button" className="btn" onClick={() => void navigate('/plans/new')}>
            {t('routines.newPlan')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void navigate('/routines/new')}
          >
            <IconPlus width={18} height={18} /> {t('routines.newRoutine')}
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
          <strong>{t('routines.hybridName')}</strong>
          <span className="badge badge--neutral">{t('routines.starter')}</span>
        </div>
        <p className="muted starter-card__blurb">
          {t('routines.hybridBlurb')}
        </p>
        <div className="row row--wrap">
          {installed && hybridPlan ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void navigate(`/plans/${hybridPlan.id}`)}
              >
                {t('routines.openPlan')}
              </button>
              <button type="button" className="btn" onClick={() => setPlannerPlanId(hybridPlan.id)}>
                {t('routines.planRotation')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void addProgram()}>
              {busy ? t('routines.adding') : t('routines.addHybrid')}
            </button>
          )}
          {installed && hybridPlan ? <span className="muted">{t('routines.alreadyIn')}</span> : null}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <div className="section-title">{t('routines.trainingPlans')}</div>
      {plans.length === 0 ? (
        <EmptyState
          title={t('routines.noPlansTitle')}
          hint={t('routines.noPlansHint')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => void navigate('/plans/new')}>
              {t('routines.createPlan')}
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
                      {days.length === 1
                        ? t('routines.dayOne', { count: days.length })
                        : t('routines.dayOther', { count: days.length })}
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

      <div className="section-title">{t('routines.unassigned')}</div>
      {loose.length === 0 ? (
        <EmptyState
          title={templates.length === 0 ? t('routines.noRoutinesTitle') : t('routines.allInPlan')}
          hint={t('routines.routineHint')}
          action={
            templates.length === 0 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void navigate('/routines/new')}
              >
                {t('routines.createFirst')}
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
                    <span className="badge badge--neutral">
                      {t('routines.exerciseCount', { count: items.length })}
                    </span>
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

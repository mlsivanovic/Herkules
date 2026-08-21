// Read-only catalog view of a starter program and each of its routines.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, Loader } from '../components/ui'
import { PlanRotationModal } from '../components/PlanRotationModal'
import {
  blockFormatLabel,
  displayExerciseName,
  useT,
  workoutRoleLabel,
} from '../lib/i18n'
import {
  equipmentCopyKey,
  isStarterInstalled,
  starterBySourceKey,
  type StarterProgram,
} from '../lib/programs/catalog'
import { hybridPlanFrom, planBySourceKey } from '../lib/programs/plans'
import { HYBRID_SOURCE_KEY } from '../lib/programs/hybrid4day'
import { formatProgramLoad, formatProgramMeta } from '../lib/programs/preview'
import { asDaySlot, type ProgramTemplate } from '../lib/programs/recipe'
import { useStore } from '../lib/store'
import './routines.css'
import './starterPreview.css'
import './planEditor.css'

export function StarterPreview() {
  const { t } = useT()
  const { sourceKey, slot: slotParam } = useParams()
  const program = sourceKey ? starterBySourceKey(sourceKey) : null
  const slot = asDaySlot(slotParam)

  if (!program) {
    return <EmptyState title={t('starters.notFound')} hint={t('starters.notFoundHint')} />
  }
  if (slotParam && !slot) {
    return <EmptyState title={t('starters.routineNotFound')} hint={t('starters.notFoundHint')} />
  }
  if (slot) {
    const template = program.templates.find((row) => row.slot === slot)
    if (!template) {
      return <EmptyState title={t('starters.routineNotFound')} hint={t('starters.notFoundHint')} />
    }
    return <StarterRoutineView program={program} template={template} />
  }
  return <StarterPlanView program={program} />
}

function useInstalledPlan(program: StarterProgram) {
  const { plans, templates } = useStore()
  const installed = isStarterInstalled(program, plans, templates)
  const plan =
    planBySourceKey(plans, program.sourceKey) ??
    (program.sourceKey === HYBRID_SOURCE_KEY ? hybridPlanFrom(plans) : null)
  return { installed, plan }
}

function StarterPlanView({ program }: { program: StarterProgram }) {
  const { t } = useT()
  const navigate = useNavigate()
  const store = useStore()
  const { installed, plan } = useInstalledPlan(program)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plannerPlanId, setPlannerPlanId] = useState<string | null>(null)
  const name = t(`starters.${program.copyKey}.name`)
  const days = program.templates.length

  async function addProgram() {
    setBusy(true)
    setError(null)
    try {
      const result = await store.installStarterProgram(program.sourceKey)
      if (result.created) setPlannerPlanId(result.planId)
      else void navigate(`/plans/${result.planId}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.addProgram'))
    } finally {
      setBusy(false)
    }
  }

  if (!store.ready) return <Loader />

  return (
    <div className="starter-preview-page">
      <div className="page-head">
        <div>
          <h1>{name}</h1>
          <small className="muted">{t('routines.starter')}</small>
        </div>
      </div>

      <div className="starter-card__meta">
        <span className="badge badge--neutral">
          {days === 1
            ? t('routines.dayOne', { count: days })
            : t('routines.dayOther', { count: days })}
        </span>
        <span className="badge badge--neutral">
          {t('starters.duration', { min: program.durationMin, max: program.durationMax })}
        </span>
        <span className="badge badge--neutral">{t(equipmentCopyKey(program.equipment))}</span>
      </div>
      <p>{t(`starters.${program.copyKey}.blurb`)}</p>
      {program.planNotes ? <p className="muted">{program.planNotes}</p> : null}
      <p className="muted">{t('starters.previewHint')}</p>

      <div className="row row--wrap starter-preview-actions">
        {installed && plan ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void navigate(`/plans/${plan.id}`)}
            >
              {t('routines.openPlan')}
            </button>
            <button type="button" className="btn" onClick={() => setPlannerPlanId(plan.id)}>
              {t('routines.planRotation')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void addProgram()}
          >
            {busy ? t('routines.adding') : t('starters.add', { name })}
          </button>
        )}
        <button type="button" className="btn" onClick={() => void navigate('/routines')}>
          {t('common.back')}
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="section-title">{t('starters.routines')}</div>
      <ul className="starter-day-list">
        {program.templates.map((template, index) => (
          <li key={template.slot}>
            <button
              type="button"
              className="card exercise-card"
              onClick={() => void navigate(`/starters/${program.sourceKey}/${template.slot}`)}
            >
              <span className="row row--between">
                <span>
                  <span className="plan-day__index">{t('editor.dayN', { n: index + 1 })}</span>
                  <strong className="starter-day-name">{template.name}</strong>
                </span>
                <span className="badge badge--neutral">
                  {template.items.length === 1
                    ? t('routines.exerciseOne', { count: template.items.length })
                    : t('routines.exerciseCount', { count: template.items.length })}
                </span>
              </span>
              {template.notes ? (
                <small className="muted">{previewNotes(template.notes)}</small>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {plannerPlanId ? (
        <PlanRotationModal planId={plannerPlanId} onClose={() => setPlannerPlanId(null)} />
      ) : null}
    </div>
  )
}

function StarterRoutineView({
  program,
  template,
}: {
  program: StarterProgram
  template: ProgramTemplate
}) {
  const { t } = useT()
  const navigate = useNavigate()
  const { exercises, ready } = useStore()
  const planName = t(`starters.${program.copyKey}.name`)

  if (!ready) return <Loader />

  return (
    <div className="starter-preview-page">
      <div className="page-head">
        <div>
          <h1>{template.name}</h1>
          <small className="muted">{planName}</small>
        </div>
      </div>
      {template.notes ? <p className="muted">{template.notes}</p> : null}

      <div className="section-title">{t('editor.exercises')}</div>
      {template.blocks.map((block) => (
        <section key={block.key} className="starter-block">
          <div className="starter-block__head">
            <span className="badge badge--neutral">{workoutRoleLabel(block.role)}</span>
            <span className="badge badge--neutral">{blockFormatLabel(block.format)}</span>
            {block.notes ? <p className="muted">{block.notes}</p> : null}
          </div>
          <ul className="starter-day-list">
            {block.items.map((item, index) => {
              const exercise = exercises.find((row) => row.id === item.exerciseId)
              const name = exercise
                ? displayExerciseName(exercise)
                : t('editor.unknownExercise')
              const meta = [formatProgramLoad(item), ...formatProgramMeta(item)].join(' · ')
              const side =
                item.sideMode === 'per_side'
                  ? t('editor.perSide')
                  : item.sideMode === 'per_leg'
                    ? t('editor.perLeg')
                    : null
              return (
                <li key={`${block.key}-${item.exerciseId}-${index}`} className="card starter-exercise">
                  <strong>{name}</strong>
                  <span className="starter-exercise__meta">
                    {meta}
                    {side ? ` · ${side}` : ''}
                  </span>
                  {item.notes ? (
                    <small className="muted starter-exercise__notes">{item.notes}</small>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="row row--wrap" style={{ marginTop: '1.1rem' }}>
        <button
          type="button"
          className="btn"
          onClick={() => void navigate(`/starters/${program.sourceKey}`)}
        >
          {t('common.back')}
        </button>
      </div>
    </div>
  )
}

function previewNotes(notes: string): string {
  return notes.replace(/^Program: .+? [ABCD]\s*/u, '').trim()
}

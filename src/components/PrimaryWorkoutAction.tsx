import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { capabilitiesFor, startableProgrammingForAccount } from '../lib/capabilities'
import { todayKey } from '../lib/dates'
import { useT } from '../lib/i18n'
import { nextTemplateForPlan } from '../lib/programs/plans'
import { occurrencesInRange, type ScheduleRef } from '../lib/recurrence'
import { useStore } from '../lib/store'
import { IconPlay, IconPlus } from './Icons'
import { BottomSheet } from './ui'

export function PrimaryWorkoutAction({ desktop = false }: { desktop?: boolean }) {
  const { t } = useT()
  const navigate = useNavigate()
  const store = useStore()
  const [open, setOpen] = useState(false)
  const active = store.sessions.find((session) => session.status === 'in_progress') ?? null
  const caps = capabilitiesFor(store.profile)
  const today = todayKey()

  const { templates: visibleTemplates } = useMemo(
    () => startableProgrammingForAccount(store.plans, store.templates, store.profile),
    [store.plans, store.profile, store.templates],
  )

  const planned = useMemo(() => {
    const refs: ScheduleRef[] = store.schedules.map((schedule) => ({
      schedule,
      rule: schedule.recurrence_rule_id
        ? store.rules.find((rule) => rule.id === schedule.recurrence_rule_id) ?? null
        : null,
    }))
    return occurrencesInRange(refs, today, today).map((occurrence) => ({
      scheduleId: occurrence.scheduleId,
      template: occurrence.templateId
        ? visibleTemplates.find((template) => template.id === occurrence.templateId)
        : occurrence.planId
          ? nextTemplateForPlan(
              occurrence.planId,
              visibleTemplates,
              store.sessions,
              store.planRoutines,
            ) ?? undefined
          : undefined,
    }))
  }, [store.planRoutines, store.rules, store.schedules, store.sessions, today, visibleTemplates])

  const recentTemplates = useMemo(() => {
    const recentIds = store.sessions
      .filter((session) => session.status === 'completed' && session.template_id)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((session) => session.template_id as string)
    const order = [...new Set(recentIds)]
    return [...visibleTemplates]
      .sort((a, b) => {
        const aIndex = order.indexOf(a.id)
        const bIndex = order.indexOf(b.id)
        if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name)
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
      .filter((template) => !planned.some((entry) => entry.template?.id === template.id))
      .slice(0, 4)
  }, [planned, store.sessions, visibleTemplates])

  function activate() {
    if (active) {
      void navigate('/workout')
      return
    }
    setOpen(true)
  }

  function start(input: { templateId?: string; scheduleItemId?: string; plannedDate?: string }) {
    setOpen(false)
    void navigate('/workout', { state: input })
  }

  return (
    <>
      <button
        type="button"
        className={`${desktop ? 'sidebar-workout-action' : 'primary-workout-action'}${active ? ' is-active' : ''}`}
        onClick={activate}
        disabled={!store.ready}
        aria-label={active ? t('workout.resume') : t('today.startWorkout')}
      >
        <span className="primary-workout-action__icon"><IconPlay width={20} height={20} /></span>
        <span>{active ? t('workout.resume') : t('common.start')}</span>
      </button>

      {open ? (
        <BottomSheet
          title={t('startSheet.title')}
          description={t('startSheet.description')}
          onClose={() => setOpen(false)}
        >
          {planned.length > 0 ? (
            <section className="start-sheet__section">
              <h3>{t('startSheet.today')}</h3>
              <div className="sheet-list">
                {planned.map((entry) => (
                  <button
                    key={entry.scheduleId}
                    type="button"
                    className="sheet-list__item sheet-list__item--primary"
                    onClick={() => start({
                      templateId: entry.template?.id,
                      scheduleItemId: entry.scheduleId,
                      plannedDate: today,
                    })}
                  >
                    <span><strong>{entry.template?.name ?? t('today.workout')}</strong><small>{t('startSheet.planned')}</small></span>
                    <IconPlay width={20} height={20} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {recentTemplates.length > 0 ? (
            <section className="start-sheet__section">
              <h3>{planned.length > 0 ? t('startSheet.otherRoutines') : t('startSheet.routines')}</h3>
              <div className="sheet-list">
                {recentTemplates.map((template) => (
                  <button key={template.id} type="button" className="sheet-list__item" onClick={() => start({ templateId: template.id })}>
                    <span><strong>{template.name}</strong><small>{t('startSheet.exerciseCount', { count: store.templateItems.filter((item) => item.template_id === template.id).length })}</small></span>
                    <IconPlay width={20} height={20} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {caps.canStartEmptyWorkout ? (
            <button type="button" className="btn btn--block start-sheet__empty" onClick={() => start({})}>
              <IconPlus width={18} height={18} /> {t('workout.emptyWorkout')}
            </button>
          ) : null}
          {planned.length === 0 && recentTemplates.length === 0 && !caps.canStartEmptyWorkout ? (
            <p className="state start-sheet__empty-state">{t('workout.noAssigned')}</p>
          ) : null}
        </BottomSheet>
      ) : null}
    </>
  )
}

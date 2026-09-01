import { NavLink } from 'react-router-dom'
import { useStore } from '../lib/store'
import { capabilitiesFor } from '../lib/capabilities'
import { useT } from '../lib/i18n'

export function PlanSectionNav() {
  const { profile } = useStore()
  const caps = capabilitiesFor(profile)
  const { t } = useT()
  const items = [
    { to: '/calendar', label: t('nav.calendar') },
    ...(caps.navRoutines ? [{ to: '/routines', label: t('nav.routines') }] : []),
    ...(caps.navExercises ? [{ to: '/exercises', label: t('nav.exercises') }] : []),
  ]

  return (
    <nav className="segment-nav" aria-label={t('nav.planSections')}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className="segment-nav__link">
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function ProgressSectionNav() {
  const { t } = useT()
  return (
    <nav className="segment-nav" aria-label={t('nav.progressSections')}>
      <NavLink to="/progress" end className="segment-nav__link">
        {t('nav.overview')}
      </NavLink>
      <NavLink to="/history" className="segment-nav__link">
        {t('nav.history')}
      </NavLink>
    </nav>
  )
}

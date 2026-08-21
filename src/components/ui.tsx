// Shared UI primitives: loading/error/empty states, modal, badges.
import { useEffect, type ReactNode } from 'react'
import type { DayWorkoutStatus } from '../lib/recurrence'
import { useT } from '../lib/i18n'

export function Loader({ label }: { label?: string }) {
  const { t } = useT()
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="state">
      <strong>{title}</strong>
      {hint ? <span>{hint}</span> : null}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT()
  return (
    <div className="state" role="alert">
      <strong>{t('common.somethingWrong')}</strong>
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          {t('common.tryAgain')}
        </button>
      ) : null}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useT()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row row--between" style={{ marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn--small" onClick={onClose} aria-label={t('common.closeDialog')}>
            {t('common.close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: DayWorkoutStatus }) {
  const { t } = useT()
  const labels: Record<DayWorkoutStatus, string> = {
    planned: t('status.planned'),
    'in-progress': t('status.inProgress'),
    completed: t('status.completed'),
    skipped: t('status.skipped'),
  }
  return <span className={`badge badge--${status}`}>{labels[status]}</span>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>
}

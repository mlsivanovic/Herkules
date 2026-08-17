// Shared UI primitives: loading/error/empty states, modal, badges.
import { useEffect, type ReactNode } from 'react'
import type { DayWorkoutStatus } from '../lib/recurrence'

export function Loader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <span>{label}</span>
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
  return (
    <div className="state" role="alert">
      <strong>Something went wrong</strong>
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          Try again
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
          <button type="button" className="btn btn--small" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<DayWorkoutStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
}

export function StatusBadge({ status }: { status: DayWorkoutStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>
}

// Shared UI primitives: loading/error/empty states, modal, badges, notes disclosure.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { DayWorkoutStatus } from '../lib/recurrence'
import { IconChevronDown, IconNote } from './Icons'
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
  closeLabel,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
  className?: string
}) {
  const { t } = useT()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={panelRef} className={`modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="row row--between" style={{ marginBottom: '0.75rem' }}>
          <h2 id={titleId} style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn--small" onClick={onClose} aria-label={closeLabel ?? t('common.closeDialog')}>
            {closeLabel ?? t('common.close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function BottomSheet({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose(): void
  children: ReactNode
}) {
  const { t } = useT()
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <span className="bottom-sheet__grabber" aria-hidden="true" />
        <div className="bottom-sheet__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" className="btn btn--icon btn--ghost" onClick={onClose} aria-label={t('common.closeDialog')}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="bottom-sheet__body">{children}</div>
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

export function NotesDisclosure({
  label,
  preview,
  open,
  onToggle,
  children,
  filled = true,
  panelId,
}: {
  label: string
  preview?: string | null
  open: boolean
  onToggle(): void
  children?: ReactNode
  filled?: boolean
  panelId?: string
}) {
  const previewText = preview?.replace(/\s+/g, ' ').trim() ?? ''
  const showPreview = !open && previewText !== ''

  return (
    <div
      className={`notes-block${open ? ' notes-block--open' : ''}${filled ? ' notes-block--filled' : ' notes-block--empty'}`}
    >
      <button
        type="button"
        className="notes-toggle"
        data-no-drag
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
      >
        <IconNote className="notes-toggle__icon" width={14} height={14} />
        <span className="notes-toggle__label">{label}</span>
        {showPreview ? <span className="notes-toggle__preview">{previewText}</span> : null}
        <IconChevronDown className="notes-toggle__chevron" width={14} height={14} />
      </button>
      {open && children ? (
        <div className="notes-panel" id={panelId}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

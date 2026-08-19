// Last-resort render guard: keeps the shell usable when a route throws or a
// lazy chunk fails to load (e.g. a stale build after a deploy while offline).
// Unsynced data is never at risk — it lives in IndexedDB, not in memory.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error === null) return this.props.children

    return (
      <div className="state" role="alert" style={{ margin: '1.5rem' }}>
        <strong>Something went wrong</strong>
        <span>
          {this.state.error.message || 'An unexpected error occurred.'} Your logged workouts are
          safe on this device — reloading usually fixes this.
        </span>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}

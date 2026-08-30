export type SyncBarStatus = 'success' | 'pending' | 'error'

export function syncBarStatus(state: {
  ready: boolean
  syncing: boolean
  pending: number
  syncError: string | null
}): SyncBarStatus | null {
  if (!state.ready) return null
  if (state.syncError) return 'error'
  if (state.syncing || state.pending > 0) return 'pending'
  return 'success'
}

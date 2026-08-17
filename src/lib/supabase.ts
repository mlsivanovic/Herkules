// Supabase client — the anon key is public by design; RLS protects the data.
// Secret keys must never appear in the frontend or the repository.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const backendConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error(
        'Supabase is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing (see SETUP.md).',
      )
    }
    client = createClient(url, anonKey)
  }
  return client
}

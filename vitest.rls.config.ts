// Separate vitest config for RLS integration tests. They run against a
// remote Supabase TEST project configured in .env.test.local
// (E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY) and are skipped gracefully when
// that file is absent.
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: loadEnv('test', process.cwd(), ''),
  },
})

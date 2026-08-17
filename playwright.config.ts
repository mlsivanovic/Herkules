// Playwright E2E: mobile viewport (360px — the narrowest supported width)
// against a production preview build wired to the Supabase TEST project.
import { defineConfig } from '@playwright/test'
import { loadEnv } from 'vite'

const env = loadEnv('test', process.cwd(), '')
const configured = Boolean(env.E2E_SUPABASE_URL && env.E2E_SUPABASE_ANON_KEY)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/Herkules',
    trace: 'retain-on-failure',
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  webServer: configured
    ? {
        command: 'node scripts/e2e-preview.mjs',
        url: 'http://localhost:4173/Herkules/',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
})

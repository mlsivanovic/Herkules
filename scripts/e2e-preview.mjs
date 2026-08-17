// Builds the app with the TEST project credentials (from .env.test.local)
// and serves the production bundle with `vite preview` for Playwright.
import { spawn, spawnSync } from 'node:child_process'
import { loadEnv } from 'vite'

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env }
if (!env.E2E_SUPABASE_URL || !env.E2E_SUPABASE_ANON_KEY) {
  console.error(
    'E2E env missing: copy .env.example to .env.test.local and fill E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY (see SETUP.md).',
  )
  process.exit(1)
}

const buildEnv = {
  ...process.env,
  VITE_SUPABASE_URL: env.E2E_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: env.E2E_SUPABASE_ANON_KEY,
}

console.log('Building production bundle with TEST project credentials…')
const build = spawnSync('npm', ['run', 'build'], { env: buildEnv, stdio: 'inherit', shell: true })
if (build.status !== 0) process.exit(build.status ?? 1)

console.log('Starting vite preview on :4173')
const preview = spawn('npx', ['vite', 'preview', '--strictPort', '--port', '4173'], {
  env: buildEnv,
  stdio: 'inherit',
  shell: true,
})
preview.on('exit', (code) => process.exit(code ?? 0))

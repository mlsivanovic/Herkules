# Herkules

Offline-first workout PWA (strength, cardio, mobility). Live at `https://mlsivanovic.github.io/Herkules/`. Comments and commits stay **English**. Visible UI strings go through `src/lib/i18n` (English source of truth, plus Latin Serbian).

Setup, env vars and deploy steps live in `SETUP.md`. Do not duplicate them here.

## Stack

React 19 + TypeScript (strict) + Vite 8 + React Router 7 `HashRouter` (GitHub Pages subpath `/Herkules/`) + Supabase (Postgres, Auth, RLS) + `idb` + `vite-plugin-pwa` (injectManifest, `src/sw.ts`). Lint with oxlint. Unit tests: Vitest. E2E: Playwright.

## Layout

- `src/types/db.ts` — row types; keep in sync with `supabase/migrations/`
- `src/lib/` — domain logic and the offline store (`store.tsx`). Pure helpers belong here with a colocated `*.test.ts`
- `src/routes/` — screens; pair a `*.css` next to the route when styles are local
- `src/components/` — shared UI (layout, editors, charts)
- `src/styles/` — tokens (`theme.css`) and primitives (`global.css`)
- `supabase/migrations/` — schema + deny-by-default RLS + seed; never put `service_role` in the frontend or this repo
- `tests/e2e/` and `tests/rls/` — skip unless `.env.test.local` is present

Commands: `npm run dev` (no SW), `npm run lint`, `npm test`, `npm run build` (`tsc -b` + Vite). E2E/RLS need the TEST Supabase project.

## Architecture

- **Offline-first.** Mutations write IndexedDB first, enqueue an idempotent outbox op, then debounce sync. Do not call Supabase from components; go through `useStore()`.
- **Canonical units** are kg / meters / seconds. Conversion is display-only (`src/lib/units.ts`).
- **RLS** owns every table. Users see only their rows; system exercises are `SELECT`-only; the anon role gets nothing. New tables need a migration with RLS, not just TypeScript types.
- **Service worker** caches the app shell only. Never cache Supabase responses.
- **Auth gate** in `App.tsx`. Workout is full-screen (outside `AppLayout`). Deep links are hash routes (`/#/calendar`).
- Prefer editing `store.tsx` / existing lib modules over adding parallel data paths.

## UI

- Mobile-first from 360 px; desktop sidebar at 768 px.
- Touch targets min 44 px (`--control-h`).
- Light/dark/system via `src/lib/theme.ts`. Reuse existing classes (`btn`, `card`, `field`, `badge`, `row`, `stack`) before inventing new ones.
- Visible strings, `aria-label`, and `title` tooltips go through `src/lib/i18n` (`en` is the source of truth; `sr` is Latin Serbian). Comments and commits stay English. Canonical stored data (exercise names, notes, CSV/JSON) stays English.

## Git

After finishing a task that changes the git working tree (feature, fix, refactor, or follow-up that should ship):

1. Stage only the files that belong to that task.
2. Commit with a message that matches this repo's existing style (imperative, specific).
3. `git push` to the tracked remote immediately. Do not wait to be asked.

Skip the push only if there is nothing to commit/push, the user explicitly said not to, or the work is still incomplete or blocked.

Pushing `main` deploys via `.github/workflows/deploy.yml` (lint → unit tests → build → GitHub Pages).

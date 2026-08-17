# Herkules — Workout Log PWA

Offline-first progressive web app for planning and logging **strength**, **cardio** and **mobility** workouts. Fast set logging, previous results at a glance, automatic rest timer, routines, a calendar with weekly planning, exercise substitution and clear progress insights.

Live: https://mlsivanovic.github.io/Herkules/

## Features

- **Auth** — email/password sign-up with email confirmation, password reset, persistent sessions
- **Today** — today's plan, active workout resume, week snapshot and streak
- **Calendar** — single-date and weekly repeating plans (optional end date); days show `planned / in-progress / completed / skipped`; editing a rule affects only future workouts — history is frozen
- **Routines** — reusable templates with exercise order, planned sets, target values, rest, notes and superset/circuit grouping; optional **Hybrid 4-day** starter (A–D) with an A→B→C→D rotation planner
- **Exercises** — system catalog (read-only) plus custom exercises (editable, archivable) across `strength / cardio / mobility` with four measurement types (`weight × reps`, `reps`, `duration`, `distance + duration`)
- **Active workout** — elapsed timer, previous values per exercise, RPE 1–10, notes, add/remove/reorder/swap exercises, automatic rest timer; only one active workout at a time
- **Offline-first** — every change is saved to IndexedDB immediately and synced through an idempotent operation queue when connectivity returns (`Pending sync` indicator); workouts can be finished fully offline
- **Progress** — workout totals, day streak, plan adherence, average duration, weekly volume, sets per muscle group, personal records and per-exercise trends (volume, Epley e1RM)
- **PWA** — installable, offline app shell, "Update available" / "Ready offline" prompts
- Units: stored canonically in kg / meters / seconds; displayed in metric or imperial per user preference. Mobile-first from 360 px; desktop gets a sidebar.

## Tech stack

React 19 · TypeScript (strict) · Vite 8 · React Router 7 (`HashRouter` for the GitHub Pages subpath) · Supabase (Postgres, Auth, RLS) · `idb` (IndexedDB) · `vite-plugin-pwa` (injectManifest + custom service worker) · Vitest · Playwright · oxlint · GitHub Actions → GitHub Pages

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (no service worker) |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests (pure domain logic) |
| `npm run test:rls` | RLS integration tests against the TEST project (skips without `.env.test.local`) |
| `npm run e2e` | Playwright mobile E2E incl. the offline scenario (skips without `.env.test.local`) |
| `npm run build` | Type-check + production build |
| `npm run preview` | Serve the production build locally |
| `npm run icons` | Regenerate PNG icons from `design/*.svg` |

## Project structure

```
src/
  main.tsx, App.tsx        # entry, hash routing, auth gate
  pwa.ts, sw.ts            # manual SW registration + prompts; precache-only worker
  styles/                  # design tokens (light/dark) + global primitives
  types/db.ts              # row types mirroring supabase/migrations
  lib/
    supabase.ts auth.tsx   # client singleton; AuthContext (signup/login/reset)
    db.ts                  # IndexedDB mirror + outbox (idb)
    outbox.ts sync.ts      # pure queue planning; push/pull transport
    store.tsx              # offline-first data layer (local writes + debounced sync)
    units.ts dates.ts      # conversions & date keys (kg/m/s canonical)
    recurrence.ts          # weekly occurrences + day statuses
    metrics.ts             # volume, Epley e1RM, PRs, streak, adherence
    validation.ts theme.ts # input validation; light/dark theme
  components/              # AppLayout (bottom nav / sidebar), SetEditor, charts, pickers…
  routes/                  # Today, Calendar, Routines(+editor), Exercises(+editor),
                           # Progress, Settings, Workout, HistoryDetail, auth screens
supabase/migrations/       # schema, RLS (deny-by-default), seed
tests/rls/                 # two-user RLS proof
tests/e2e/                 # Playwright: auth, full flow, offline, shell
.github/workflows/         # deploy.yml (lint→test→build→Pages + optional E2E), keepalive.yml
```

## Security model

- The frontend only ever holds `VITE_SUPABASE_URL` and the **public anon key**; service-role keys never enter the repo or the bundle.
- Row Level Security is enabled on every table with privileges revoked by default. Users read/write only rows they own; child tables verify ownership through their parent; system exercises are `SELECT`-only; the anonymous role gets nothing.
- The service worker caches the app shell only — Supabase responses are never cached.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: install → lint → unit tests → build (with `VITE_*` from repository **Variables**) → GitHub Pages. One-time setup (Supabase project, migrations, Auth URLs, Variables) is in [SETUP.md](SETUP.md).

## Manual verification checklist

Automated tests cover the acceptance criteria; a few things are still worth a human eye after each release:

1. Install the PWA from the browser (install prompt / Add to Home Screen) and confirm it launches standalone.
2. Deploy a change and confirm the **Update available** toast appears on the next visit, and that tapping *Update* reloads the new version.
3. Direct-open a deep hash route (e.g. `https://…/Herkules/#/calendar`) — no 404.
4. Airplane-mode a real device: start a workout, log sets, finish, reopen the app — data intact and marked *Pending sync* until back online.

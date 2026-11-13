# Herkules — Setup Guide

One-time setup for the production Supabase project, the TEST project used by
automated tests, and the GitHub Pages deployment.

---

## 1. Supabase project (production)

1. Create a project at [supabase.com](https://supabase.com) (any region).
2. Note **Settings → API**: `Project URL` and the `anon / public` key.
   The anon key is **public by design** — Row Level Security protects all data.
   The `service_role` key must never appear in the frontend or this repository.

## 2. Apply migrations with the Supabase CLI

```bash
brew install supabase/tap/supabase      # or: npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates the whole schema (`profiles`, `exercises`, `training_plans`,
`workout_templates`, `template_items`, `recurrence_rules`, `schedule_items`,
`workout_sessions`, `session_exercises`, `workout_sets`, `body_weight_entries`,
`tendon_checkins`, plus coaching tables `coaching_relationships`,
`coach_invites`, `session_comments`),
enables deny-by-default RLS on every table and seeds the system exercise catalog.

Verify the RLS posture (anonymous access must be denied):

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: <anon-key>" \
  "<project-url>/rest/v1/workout_sessions?select=id&limit=1"
# expected: 401/403 — anything else means migrations are missing
```

## 3. Authentication settings

In **Authentication → Providers → Email**:

- Keep **Confirm email** ON for production (the sign-up screen then asks users
  to confirm before signing in).
- In **Authentication → URL Configuration**, add both redirect URLs:
  - `https://mlsivanovic.github.io/Herkules/**`
  - `http://localhost:5173/Herkules/**` (local development)

A profile row is created automatically by a database trigger on first sign-in.

## 4. Local development

```bash
npm install
cp .env.example .env.local
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from step 1
npm run dev
```

The app runs at `http://localhost:5173/Herkules/` (the same subpath as
production, so `HashRouter` links behave identically). The service worker is
disabled in dev mode; use `npm run build && npm run preview` to test PWA
behavior locally.

## 5. GitHub Pages deployment

1. Repository → **Settings → Pages → Source: GitHub Actions**.
2. Repository → **Settings → Secrets and variables → Actions → Variables**:
   - `VITE_SUPABASE_URL` = production project URL
   - `VITE_SUPABASE_ANON_KEY` = production anon key

   (Variables, not Secrets — the values are embedded in the public bundle and
   protected by RLS.)
3. Push to `main`. `.github/workflows/deploy.yml` runs
   install → lint → unit tests → build → Pages deploy.

## 6. TEST project for E2E/RLS

Integration and Playwright tests run against a **separate Supabase project**
so test users never touch production data:

1. Create a second (free) Supabase project and run step 2 against it.
2. In **Authentication → Providers → Email**, turn **Confirm email OFF**
   (tests sign up via the API/UI and need an immediate session).
3. Locally:

   ```bash
   cp .env.example .env.test.local
   # fill E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY with the TEST project values
   npm run test:rls   # two-user RLS isolation proof
   npm run e2e        # mobile flows incl. the offline scenario (builds first)
   ```

   `.env.test.local` is gitignored. Test users accumulate in the TEST project's
   Auth — delete them from the dashboard occasionally, or rotate the project.
4. In CI, add repository **Secrets** `E2E_SUPABASE_URL` and
   `E2E_SUPABASE_ANON_KEY`. The optional `e2e` job then runs RLS + Playwright
   tests on every push to `main`; without them it is skipped.

## 7. Icons

After changing `design/icon-source*.svg`, regenerate the PNGs (requires
devDependency `sharp`):

```bash
npm run icons
```

## 8. Android sideload (not Play Store)

The phone app is the same React app inside a Capacitor WebView, plus a small
Kotlin plugin that reads Health Connect and, when a sensor advertises the
standard heart-rate service, keeps a Bluetooth connection during a workout.
GitHub Pages and this APK share one Supabase account.

One-time keystore, kept outside the repo. Losing it means the next APK cannot
update the installed app.

```bash
keytool -genkeypair -v \
  -keystore herkules-release.keystore \
  -alias herkules \
  -keyalg RSA -keysize 2048 -validity 10000
```

Repository **Secrets** (not Variables):

- `ANDROID_KEYSTORE_BASE64` — `base64 < herkules-release.keystore | pbcopy` output
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS` — `herkules`, unless you chose another alias
- `ANDROID_KEY_PASSWORD`

`package.json` `version`, `android/app/build.gradle` `versionName`, and
`versionCode` stay in step. Bump `versionCode` by 1 for every APK you install
over an older one.

Build locally (JDK 21):

```bash
npm run android:sync
cd android
ANDROID_KEYSTORE_PATH=/absolute/path/herkules-release.keystore \
ANDROID_KEYSTORE_PASSWORD=… \
ANDROID_KEY_ALIAS=herkules \
ANDROID_KEY_PASSWORD=… \
  ./gradlew assembleRelease
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`.

Publish: tag `android-v1.2.0` (matching `versionName`) and push it. The
`android.yml` workflow signs the APK and attaches it to that GitHub Release.
A manual run of the workflow uploads the APK as an Actions artifact instead.
The installed app links to a newer `android-v*` release when one exists.

On the Galaxy S25, before expecting watch data:

1. Samsung Health → Settings → Health Connect → allow exercise and heart rate.
2. Mi Fitness → Profile → third-party data → Health Connect → the same types,
   if a probe shows Samsung Health is not already passing Xiaomi workouts through.
3. In Herkules: Settings → Import from Health Connect. The list shows the
   writing app, the workout, and how many heart-rate samples arrived.
4. If a Galaxy Watch workout is missing, open Samsung Health and pull down on
   the home screen, then look again.

Install the APK from the Release page. Android asks to allow installs from
the browser. The next signed build with a higher `versionCode` updates it.

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Supabase is not configured…` banner | `.env.local` missing or empty; restart `npm run dev` after editing |
| Sign-up stuck on "Check your email" | Expected with Confirm email ON — open the emailed link first |
| RLS tests fail with `signUp returned no session` | Confirm email is still ON on the TEST project (step 6.2) |
| `permission denied for table …` in the browser console while signed out | Normal — the anon role is denied everything by design |
| Free-tier project paused | Supabase pauses projects after ~7 idle days; the `keepalive.yml` workflow pings PostgREST twice a week to prevent it |
| Sync stuck on "Pending sync" with an error badge | Usually a temporary network/API issue — it retries on reconnect/focus; check the message in Settings |

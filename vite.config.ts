import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
).version

// The Android APK bundles this build with a relative base and no service worker.
// GitHub Pages keeps the /Herkules/ subpath and the app-shell worker.
const android = process.env.HERKULES_ANDROID === '1'

// Served from the GitHub Pages subpath /Herkules/
export default defineConfig({
  base: android ? './' : '/Herkules/',
  // Without VitePWA the virtual module does not exist; src/pwa.ts still imports it.
  resolve: android
    ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/android/pwaRegisterStub.ts', import.meta.url)) } }
    : undefined,
  define: {
    __HERKULES_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    ...(android
      ? []
      : [
          VitePWA({
            registerType: 'prompt',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            // Registration is done manually in src/pwa.ts (custom toast prompts)
            injectRegister: false,
            devOptions: { enabled: false },
            // The manifest is a static file in public/ with relative URLs
            manifest: false,
            injectManifest: {
              // Cache the app shell only; Supabase requests are NEVER cached
              globPatterns: ['**/*.{js,css,html,webmanifest,svg,png,woff2}'],
            },
          }),
        ]),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

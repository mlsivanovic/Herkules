import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from the GitHub Pages subpath /Herkules/
export default defineConfig({
  base: '/Herkules/',
  plugins: [
    react(),
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
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

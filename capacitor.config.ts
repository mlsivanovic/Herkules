import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.mlsivanovic.herkules',
  appName: 'Herkules',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SystemBars: {
      // Draw the web view under the status and gesture bars. The page already
      // pads with env(safe-area-inset-*), so controls stay clear of them.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config

// Android build stand-in for vite-plugin-pwa's virtual module. The APK ships
// its assets and registers no service worker; src/pwa.ts returns before this runs.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {}
}

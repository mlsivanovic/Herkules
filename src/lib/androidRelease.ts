// Decides whether a GitHub Release is a newer sideload APK than this build.

export interface ReleaseAsset {
  name?: string
  browser_download_url?: string
}

export interface ReleasePayload {
  tag_name?: string
  assets?: ReleaseAsset[]
}

export interface AndroidRelease {
  tag: string
  url: string
}

/** `android-v1.2.0` with an `.apk` asset. Other tags are ignored. */
export function parseAndroidRelease(payload: ReleasePayload): AndroidRelease | null {
  const tag = payload.tag_name ?? ''
  if (!/^android-v\d/.test(tag)) return null
  const apk = (payload.assets ?? []).find(
    (asset) => asset.name?.endsWith('.apk') && typeof asset.browser_download_url === 'string',
  )
  if (!apk?.browser_download_url) return null
  return { tag, url: apk.browser_download_url }
}

function parts(version: string): number[] {
  return version
    .replace(/^android-v/, '')
    .split('.')
    .map((part) => {
      const value = Number.parseInt(part, 10)
      return Number.isFinite(value) ? value : 0
    })
}

/** True when the release tag is a higher x.y.z than the running app. */
export function isNewerAndroidRelease(current: string, tag: string): boolean {
  const local = parts(current)
  const remote = parts(tag)
  const length = Math.max(local.length, remote.length)
  for (let i = 0; i < length; i++) {
    const delta = (remote[i] ?? 0) - (local[i] ?? 0)
    if (delta !== 0) return delta > 0
  }
  return false
}

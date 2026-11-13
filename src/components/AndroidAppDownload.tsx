import { useEffect, useState } from 'react'
import {
  ANDROID_RELEASES_PAGE,
  androidReleaseVersion,
  fetchLatestAndroidRelease,
  type AndroidRelease,
} from '../lib/androidRelease'
import { isNativeApp } from '../lib/herkulesHealth'
import { useT } from '../lib/i18n'

/**
 * Web/PWA only: a direct link to the newest signed APK on GitHub Releases.
 * Falls back to the releases page while loading or when GitHub is unreachable.
 */
export function AndroidAppDownload() {
  const { t } = useT()
  const [release, setRelease] = useState<AndroidRelease | null>(null)

  useEffect(() => {
    if (isNativeApp()) return
    let alive = true
    void fetchLatestAndroidRelease().then((latest) => {
      if (alive) setRelease(latest)
    })
    return () => {
      alive = false
    }
  }, [])

  if (isNativeApp()) return null

  return (
    <div className="stack">
      <p style={{ margin: 0 }}>{t('settings.androidAppBody')}</p>
      <a
        className="btn btn--primary"
        href={release?.url ?? ANDROID_RELEASES_PAGE}
        target="_blank"
        rel="noopener noreferrer"
      >
        {release
          ? t('settings.androidAppDownloadVersion', { version: androidReleaseVersion(release.tag) })
          : t('settings.androidAppDownload')}
      </a>
      <small className="muted">{t('settings.androidAppHint')}</small>
    </div>
  )
}

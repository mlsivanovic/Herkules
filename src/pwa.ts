// Manual service worker registration + update/offline-ready prompts.
// The toast lives outside the React tree (vanilla DOM), styled by global.css.
import { t } from './lib/i18n'

const TOAST_ID = 'herkules-toast'

function showToast(message: string, action: string, onAction: () => void): void {
  dismissToast()
  const wrap = document.createElement('div')
  wrap.className = 'toast-wrap'
  wrap.id = TOAST_ID
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')

  const text = document.createElement('span')
  text.textContent = message
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn--primary btn--small'
  button.textContent = action
  button.addEventListener('click', () => {
    dismissToast()
    onAction()
  })

  toast.append(text, button)
  wrap.appendChild(toast)
  document.body.appendChild(wrap)
}

function dismissToast(): void {
  document.getElementById(TOAST_ID)?.remove()
}

export function startUpdateCheck(): void {
  if (import.meta.env.DEV) return
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateNow = registerSW({
        onNeedRefresh() {
          showToast(t('pwa.updateBody'), t('pwa.updateAction'), () => void updateNow(true))
        },
        onOfflineReady() {
          showToast(t('pwa.offlineReady'), t('common.ok'), dismissToast)
        },
      })
    })
    .catch(() => {
      // No service worker support — silently ignore
    })
}

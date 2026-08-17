// Manual service worker registration + update/offline-ready prompts.
// The toast lives outside the React tree (vanilla DOM), styled by global.css.

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
          showToast('A new version is available.', 'Update', () => void updateNow(true))
        },
        onOfflineReady() {
          showToast('Herkules is ready to work offline.', 'OK', dismissToast)
        },
      })
    })
    .catch(() => {
      // No service worker support — silently ignore
    })
}

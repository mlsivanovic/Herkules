import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startSystemThemeListener } from './lib/theme'
import { applySavedLocale, startSystemLocaleListener } from './lib/i18n'
import { startUpdateCheck } from './pwa'
import './styles/theme.css'
import './styles/global.css'
import './components/appLayout.css'

applySavedLocale()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startSystemThemeListener()
startSystemLocaleListener()
startUpdateCheck()

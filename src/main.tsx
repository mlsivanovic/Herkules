import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startUpdateCheck } from './pwa'
import './styles/theme.css'
import './styles/global.css'
import './components/appLayout.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startUpdateCheck()

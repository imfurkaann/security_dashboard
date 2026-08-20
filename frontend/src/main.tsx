import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BRANDING, loadBranding } from './config/branding'
// Türkiye saat dilimi ve locale ayarları
import './utils/dayjsConfig'

const bootstrapApplication = async () => {
  await loadBranding()
  document.title = BRANDING.applicationName
  document.querySelector('meta[name="application-name"]')?.setAttribute('content', BRANDING.applicationName)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrapApplication()

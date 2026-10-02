import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { tokenFromSearch } from './share'
import { Viewer } from './Viewer'

const token = tokenFromSearch(location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {token ? <Viewer token={token} /> : <App />}
  </StrictMode>,
)

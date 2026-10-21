import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PageLoadBoundary, PageRecoveryModal } from './components/common/PageRecovery'
import { listenForPreloadErrors } from './services/pageRecovery'

// Handle Vite dynamic import errors (usually caused by new deployments clearing old chunks)
const stopListening = listenForPreloadErrors(window);
if (import.meta.hot) import.meta.hot.dispose(stopListening);

createRoot(document.getElementById('root')!).render(
 <StrictMode>
 <PageLoadBoundary><App /></PageLoadBoundary>
 <PageRecoveryModal />
 </StrictMode>,
)

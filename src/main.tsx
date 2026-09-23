import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle Vite dynamic import errors (usually caused by new deployments clearing old chunks)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error, reloading page...', event);
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
 <StrictMode>
 <App />
 </StrictMode>,
)

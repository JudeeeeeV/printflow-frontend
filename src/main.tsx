import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle Vite dynamic import errors (usually caused by new deployments clearing old chunks)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error:', event);
  if (confirm('A new update is available (or a file failed to load). Would you like to refresh the page to apply it?')) {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
 <StrictMode>
 <App />
 </StrictMode>,
)

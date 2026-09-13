import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Control de versión para forzar actualización y purga de caché en clientes y móviles
const APP_VERSION = '1.0.4';
try {
  const currentStored = localStorage.getItem('app_version');
  if (currentStored && currentStored !== APP_VERSION) {
    console.log(`🚀 Actualizando versión a ${APP_VERSION}. Limpiando caché de navegador...`);
    localStorage.setItem('app_version', APP_VERSION);
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }
  } else if (!currentStored) {
    localStorage.setItem('app_version', APP_VERSION);
  }
} catch (e) {
  console.warn('Error verificando versión de caché:', e);
}

createRoot(document.getElementById('root')!).render(
  <App />
);

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Control de versión para forzar actualización, purga de caché, Service Workers y cookies en clientes
const APP_VERSION = '1.0.6';

const clearAllCookies = () => {
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
      }
    }
    console.log('🍪 Cookies del navegador borradas correctamente.');
  } catch (err) {
    console.warn('Error borrando cookies:', err);
  }
};

try {
  const currentStored = localStorage.getItem('app_version');
  if (currentStored && currentStored !== APP_VERSION) {
    console.log(`🚀 Actualizando versión de ${currentStored} a ${APP_VERSION}. Limpiando caché y cookies del navegador...`);
    
    // 1. Borrar Cookies del navegador
    clearAllCookies();

    // 2. Limpiar Cachés de la PWA
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // 3. Desregistrar Service Workers antiguos
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }

    localStorage.setItem('app_version', APP_VERSION);
  } else if (!currentStored) {
    localStorage.setItem('app_version', APP_VERSION);
  }
} catch (e) {
  console.warn('Error verificando versión de caché:', e);
}

createRoot(document.getElementById('root')!).render(
  <App />
);

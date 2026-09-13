import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Control de versión para forzar actualización, purga de caché, Service Workers y cookies en clientes
const APP_VERSION = '1.0.7';

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

    // 2. Guardar nueva versión primero
    localStorage.setItem('app_version', APP_VERSION);

    // 3. Limpiar Cachés de la PWA y Service Workers, luego recargar forzadamente la ventana
    const purgeAndReload = async () => {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
      } catch (err) {
        console.warn('Error purgando cachés PWA:', err);
      } finally {
        window.location.reload();
      }
    };

    purgeAndReload();
  } else if (!currentStored) {
    localStorage.setItem('app_version', APP_VERSION);
  }
} catch (e) {
  console.warn('Error verificando versión de caché:', e);
}

createRoot(document.getElementById('root')!).render(
  <App />
);

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Control de versión para forzar actualización, purga de caché, Service Workers y cookies en clientes PWA y Android
const APP_VERSION = '1.0.9';

export const clearAllCookies = () => {
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

export const purgeCacheAndReload = async (targetVersion: string = APP_VERSION) => {
  console.log(`🚀 Ejecutando purga total de caché PWA y cookies para versión ${targetVersion}...`);
  try {
    clearAllCookies();
    localStorage.setItem('app_version', targetVersion);

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

// Exponer en window para llamadas desde cualquier componente o botón manual
(window as any).purgeCacheAndReload = purgeCacheAndReload;

// Comprobación de versión remota al iniciar (Supera cachés agresivas en Android PWA)
(async () => {
  try {
    const currentStored = localStorage.getItem('app_version');
    
    // Consultar version.json directo al servidor sin caché
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (res.ok) {
      const data = await res.json();
      const serverVersion = data?.version || APP_VERSION;

      if (currentStored !== serverVersion || APP_VERSION !== serverVersion) {
        console.log(`📡 Nueva versión detectada en servidor: ${serverVersion} (local: ${currentStored})`);
        await purgeCacheAndReload(serverVersion);
        return;
      }
    }

    if (currentStored && currentStored !== APP_VERSION) {
      await purgeCacheAndReload(APP_VERSION);
      return;
    } else if (!currentStored) {
      localStorage.setItem('app_version', APP_VERSION);
    }
  } catch (e) {
    console.warn('Error verificando versión remota de caché:', e);
  }
})();

createRoot(document.getElementById('root')!).render(
  <App />
);

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Control de versión dinámico por buildId (inyectado en build por Vite)
declare const __APP_BUILD_ID__: string;
export const APP_VERSION = '1.1.3';
export const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

// En localhost / desarrollo, desactivar completamente el auto-recarga y desregistrar service workers previos
const isDev = Boolean(
  import.meta.env.DEV ||
  CURRENT_BUILD_ID === 'dev' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

if (isDev && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}

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

export const purgeCacheAndReload = async () => {
  console.log('🚀 Ejecutando actualización y recarga limpia de la aplicación...');
  try {
    // 1. Desregistrar Service Workers existentes para que no intercepten con errores
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    // 2. Limpiar cachés
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
    // 3. Limpiar cookies para forzar sesión y estado limpios
    clearAllCookies();
  } catch (err) {
    console.warn('Error purgando cachés PWA:', err);
  } finally {
    // Recarga limpia directa al origen sin query params que causen conflicto de enrutamiento
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.href = cleanUrl;
  }
};

// Exponer en window para llamadas desde botones de actualizar o recarga
(window as any).purgeCacheAndReload = purgeCacheAndReload;

// Comprobación de versión remota al iniciar o al recuperar foco (solo en PRODUCCIÓN)
export const checkForAppUpdates = async () => {
  if (isDev) return;

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const serverBuildId = String(data?.buildId || data?.version || '');

      if (serverBuildId && serverBuildId !== CURRENT_BUILD_ID) {
        // Protección estricta contra bucle infinito: no recargar si ya se recargó en los últimos 15s
        const lastAttempt = sessionStorage.getItem(`reloaded_for_${serverBuildId}`);
        const lastTime = Number(sessionStorage.getItem('last_auto_reload_time') || 0);
        if (lastAttempt || (Date.now() - lastTime < 15000)) {
          return;
        }

        console.log(`📡 Nueva versión detectada en servidor: ${serverBuildId} (actual: ${CURRENT_BUILD_ID})`);
        sessionStorage.setItem(`reloaded_for_${serverBuildId}`, 'true');
        sessionStorage.setItem('last_auto_reload_time', String(Date.now()));
        await purgeCacheAndReload();
        return;
      }
    }
  } catch (e) {
    console.warn('Error verificando versión remota de caché:', e);
  }
};

(window as any).checkForAppUpdates = checkForAppUpdates;

// Solo activar Service Worker listeners en producción fuera de localhost
if (!isDev && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('🔄 Nuevo Service Worker activo, recargando aplicación...');
      window.location.reload();
    }
  });

  // Ejecutar verificación inicial
  checkForAppUpdates();

  // Verificar cuando el usuario vuelve a la app (cambio de pestaña / desbloqueo de móvil)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdates();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <App />
);

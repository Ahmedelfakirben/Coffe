import { supabase } from './supabase';
import { APP_VERSION } from '../main';
import { isMobileDevice } from './qzTray'; // Reutilizamos esta función

const DEVICE_ID_KEY = 'caisse_device_id';

export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const getDeviceName = (): string => {
  const isMobile = isMobileDevice();
  const ua = navigator.userAgent;
  let os = 'Unknown';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iPad|iPhone|iPod/.test(ua)) os = 'iOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const type = isMobile ? 'Móvil/Tablet' : 'PC/Caja';
  return `${type} (${os})`;
};

export const registerDevice = async (employeeId?: string | null) => {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  try {
    const payload: any = {
      device_id: deviceId,
      device_name: deviceName,
      app_version: APP_VERSION,
      last_seen: new Date().toISOString()
    };

    if (employeeId !== undefined) {
      payload.employee_id = employeeId;
    }

    const { error } = await supabase
      .from('connected_devices')
      .upsert(payload, { onConflict: 'device_id' });

    if (error) {
      console.warn('Error registrando dispositivo:', error);
    }
  } catch (err) {
    console.warn('Excepción registrando dispositivo:', err);
  }
};

export const listenForForceReload = (onReloadCommand: () => void) => {
  const deviceId = getDeviceId();

  const channel = supabase.channel(`device_${deviceId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'connected_devices',
      filter: `device_id=eq.${deviceId}`
    }, (payload) => {
      const newRecord = payload.new;
      if (newRecord && newRecord.force_reload === true) {
        console.log('🚨 Comando de recarga forzada recibido del servidor.');
        
        // Reset the flag immediately so we don't reload endlessly
        supabase.from('connected_devices').update({ force_reload: false }).eq('device_id', deviceId).then(() => {
          onReloadCommand();
        });
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

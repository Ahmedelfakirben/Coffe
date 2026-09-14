import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ConnectedDevice } from '../types/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { Smartphone, Monitor, RefreshCw, Power, Server, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

export function DeviceManager() {
  const { t } = useLanguage();
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [forcingReload, setForcingReload] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('connected_devices')
        .select(`
          *,
          employee_profiles (
            full_name
          )
        `)
        .order('last_seen', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    // Suscribirse a cambios para ver las versiones actualizarse en tiempo real
    const channel = supabase.channel('devices_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connected_devices' }, () => {
        fetchDevices();
      })
      .subscribe();

    // Actualizar el "hace X minutos" cada 30 segundos
    const interval = setInterval(() => {
      setDevices(prev => [...prev]);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleForceReload = async (deviceId: string) => {
    setForcingReload(deviceId);
    try {
      const { error } = await supabase
        .from('connected_devices')
        .update({ force_reload: true })
        .eq('device_id', deviceId);

      if (error) throw error;
      toast.success(t('Señal enviada. El dispositivo se recargará en breve.'));
    } catch (err) {
      console.error('Error forcing reload:', err);
      toast.error(t('Error al enviar señal'));
    } finally {
      setTimeout(() => setForcingReload(null), 2000);
    }
  };

  const handleForceReloadAll = async () => {
    if (!window.confirm(t('¿Estás seguro? Esto forzará el reinicio de TODOS los dispositivos conectados actualmente.'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('connected_devices')
        .update({ force_reload: true })
        .neq('device_id', 'none'); // Update all

      if (error) throw error;
      toast.success(t('Señal enviada a todos los dispositivos.'));
    } catch (err) {
      console.error('Error forcing reload all:', err);
      toast.error(t('Error al enviar señal'));
    }
  };

  const isOnline = (lastSeen: string) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 1000 * 60 * 5; // 5 minutos = online
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">{t('Cargando dispositivos...')}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-600" />
            {t('Gestor de Dispositivos')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('Control y actualización en tiempo real de todos los móviles y PCs conectados al sistema.')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDevices}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            {t('Actualizar')}
          </button>
          <button
            onClick={handleForceReloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Power className="w-4 h-4" />
            {t('Recargar Todos')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
            <p className="text-gray-500">{t('No hay dispositivos registrados aún.')}</p>
          </div>
        ) : (
          devices.map((device) => {
            const online = isOnline(device.last_seen);
            const isMobile = device.device_name.includes('Móvil');

            return (
              <div key={device.device_id} className={`bg-white rounded-xl shadow-sm border transition-all ${online ? 'border-indigo-200 shadow-indigo-100/50' : 'border-gray-200 opacity-75'}`}>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${online ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                        {isMobile ? <Smartphone className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 line-clamp-1" title={device.device_name}>
                          {device.device_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span className="text-xs font-medium text-gray-500">
                            {online ? t('Conectado') : t('Desconectado')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('Usuario')}:</span>
                      <span className="font-medium text-gray-900">{device.employee_profiles?.full_name || t('Desconocido')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('Versión App')}:</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        v{device.app_version}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('Última vez')}:</span>
                      <span className="text-gray-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleForceReload(device.device_id)}
                    disabled={forcingReload === device.device_id}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      forcingReload === device.device_id
                        ? 'bg-indigo-50 text-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${forcingReload === device.device_id ? 'animate-spin' : ''}`} />
                    {forcingReload === device.device_id ? t('Enviando señal...') : t('Forzar Recarga y Limpieza')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PrintJob } from '../types/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw, CheckCircle, XCircle, Clock, Printer, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export function PrintMonitor() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching print jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const channel = supabase.channel('print_jobs_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => {
        fetchJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('print_jobs')
        .update({ status: 'pending', error_message: null })
        .eq('id', jobId);

      if (error) throw error;
      toast.success(t('Trabajo enviado a la cola nuevamente'));
    } catch (err) {
      console.error('Error retrying job:', err);
      toast.error(t('Error al reintentar'));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return t('Completado');
      case 'failed': return t('Fallido');
      case 'processing': return t('Procesando');
      default: return t('Pendiente');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">{t('Cargando historial de impresión...')}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Printer className="w-6 h-6 text-amber-600" />
            {t('Auditoría de Impresión')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('Monitor en tiempo real de todos los tickets enviados a las impresoras.')}
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <RefreshCw className="w-4 h-4" />
          {t('Actualizar')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Fecha/Hora')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Tipo')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Estado')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Detalles')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">{t('Acciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {t('No hay trabajos de impresión registrados.')}
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className={`hover:bg-gray-50 transition-colors ${job.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(job.created_at), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {job.ticket_type === 'invoice' ? t('Caja') : job.ticket_type === 'kitchen' ? t('Cocina') : job.ticket_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className={`text-sm font-medium ${
                          job.status === 'completed' ? 'text-green-700' :
                          job.status === 'failed' ? 'text-red-700' :
                          job.status === 'processing' ? 'text-blue-700' : 'text-amber-700'
                        }`}>
                          {getStatusText(job.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {job.error_message ? (
                        <div className="flex items-start gap-2 text-red-600 text-sm max-w-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="truncate" title={job.error_message}>{job.error_message}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {t('Reintentar')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PrintJob } from '../types/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw, CheckCircle, XCircle, Clock, Printer, AlertTriangle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export function PrintMonitor() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredJobs = jobs.filter(job => {
    if (!searchTerm) return true;
    
    let orderNum = '';
    let cashierName = '';
    
    if (job.content) {
      if (job.ticket_type === 'kitchen') {
        orderNum = job.content.orderNum || '';
      } else {
        orderNum = job.content.ticketData?.orderNumber || '';
        cashierName = job.content.ticketData?.cashierName || '';
      }
    }
    
    const searchLower = searchTerm.toLowerCase();
    return orderNum.toLowerCase().includes(searchLower) || 
           cashierName.toLowerCase().includes(searchLower);
  });

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
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('Buscar por #pedido o cajero...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500 w-64 shadow-sm"
            />
          </div>
          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            {t('Actualizar')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Fecha/Hora')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Pedido')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('Trabajos de Impresión')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">{t('Acciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? t('No se encontraron resultados.') : t('No hay trabajos de impresión registrados.')}
                  </td>
                </tr>
              ) : (
                Object.entries(
                  filteredJobs.reduce((acc, job) => {
                    let orderNum = '-';
                    if (job.content) {
                      if (job.ticket_type === 'kitchen') orderNum = job.content.orderNum || '-';
                      else orderNum = job.content.ticketData?.orderNumber || '-';
                    }
                    if (!acc[orderNum]) acc[orderNum] = [];
                    acc[orderNum].push(job);
                    return acc;
                  }, {} as Record<string, PrintJob[]>)
                ).map(([orderNum, orderJobs]) => (
                  <tr key={orderNum} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                      {format(new Date(orderJobs[0].created_at), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
                        {orderNum}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-3">
                        {orderJobs.map(job => (
                          <div key={job.id} className={`flex items-start gap-4 p-3 rounded-lg border ${job.status === 'failed' ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                                  {job.ticket_type === 'invoice' ? t('Caja') : job.ticket_type === 'kitchen' ? t('Cocina') : job.ticket_type}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {getStatusIcon(job.status)}
                                  <span className={`text-xs font-bold ${
                                    job.status === 'completed' ? 'text-green-700' :
                                    job.status === 'failed' ? 'text-red-700' :
                                    job.status === 'processing' ? 'text-blue-700' : 'text-amber-700'
                                  }`}>
                                    {getStatusText(job.status)}
                                  </span>
                                </div>
                              </div>
                              
                              {job.ticket_type !== 'kitchen' && job.content?.ticketData && (
                                <div className="flex flex-col gap-1 mt-1">
                                  {job.content.ticketData.cashierName && (
                                    <div className="text-xs text-gray-500">
                                      {t('Cajero:')} {job.content.ticketData.cashierName}
                                    </div>
                                  )}
                                  <div className="text-xs">
                                    {job.content.ticketData.paymentMethod === 'En attente' || job.content.ticketData.paymentMethod === 'Pendiente' ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        {t('Ticket Pendiente')}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                                        {t('Ticket Final')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {job.error_message && (
                                <div className="flex items-start gap-1 text-red-600 text-xs mt-1.5 max-w-sm">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span className="truncate" title={job.error_message}>{job.error_message}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="text-right">
                              {job.status === 'failed' && (
                                <button
                                  onClick={() => handleRetry(job.id)}
                                  className="text-xs text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                >
                                  {t('Reintentar')}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
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

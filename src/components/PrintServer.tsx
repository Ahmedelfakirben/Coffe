import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { printKitchenRouting, printMainTicket } from '../lib/printerService';
import { qzService } from '../lib/qzTray';

export function PrintServer() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    // Verificar si somos el servidor de impresión
    const isPrintServer = localStorage.getItem('print_server_active') === 'true';
    if (!isPrintServer) return;

    console.log('🖨️ MODO SERVIDOR DE IMPRESIÓN ACTIVO (SPOOLER): Escuchando cola de impresión...');

    // Inicializar y mantener viva la conexión QZ Tray
    const testQZConnection = async () => {
      try {
        const connected = await qzService.connect();
        if (connected) {
          console.log('✅ Conexión QZ Tray (Servidor) activa');
        } else {
          console.warn('⚠️ No se pudo establecer conexión QZ Tray');
        }
      } catch (e) {
        console.error('Error en heartbeat QZ Tray:', e);
      }
    };
    
    testQZConnection();
    const qzHeartbeat = setInterval(testQZConnection, 120000);

    const loadCompanyInfo = async () => {
      try {
        const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
        return data || { company_name: 'Restaurante' };
      } catch {
        return { company_name: 'Restaurante' };
      }
    };

    const loadDependencies = async () => {
      const [{ data: categories }, { data: tables }] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('tables').select('*')
      ]);
      return { categories: categories || [], tables: tables || [] };
    };

    const processPrintJob = async (jobId: string) => {
      try {
        // Bloquear atómicamente el trabajo para evitar que otro PC lo imprima
        const { data: job, error: lockError } = await supabase
          .from('print_jobs')
          .update({ status: 'processing' })
          .eq('id', jobId)
          .eq('status', 'pending')
          .select()
          .maybeSingle();

        if (lockError || !job) {
          // El trabajo ya fue tomado por otro servidor, o hubo un error
          return;
        }

        console.log(`🖨️ Procesando trabajo de impresión [${job.ticket_type}]: ${jobId}`);

        if (job.ticket_type === 'kitchen') {
          const deps = await loadDependencies();
          await printKitchenRouting({
            orderNum: job.content.orderNum,
            cartItems: job.content.cartItems,
            categories: deps.categories,
            tables: deps.tables,
            tableId: job.content.tableId,
            serviceType: job.content.serviceType || 'takeaway'
          });
        } else if (job.ticket_type === 'invoice' || job.ticket_type === 'receipt') {
          const companyInfo = await loadCompanyInfo();
          await printMainTicket({
            ticketData: job.content.ticketData,
            companyInfo,
            formatCurrency,
            t
          });
        }

        // Marcar como completado
        await supabase
          .from('print_jobs')
          .update({ status: 'completed' })
          .eq('id', jobId);

        console.log(`✅ Trabajo de impresión completado: ${jobId}`);
      } catch (err: any) {
        console.error(`❌ Error procesando trabajo de impresión ${jobId}:`, err);
        // Marcar como fallido
        await supabase
          .from('print_jobs')
          .update({ status: 'failed', error_message: err.message || 'Error desconocido' })
          .eq('id', jobId);
      }
    };

    const channel = supabase.channel('print_server_spooler')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs', filter: "status=eq.pending" }, (payload) => {
        const newJob = payload.new;
        if (newJob?.id) {
          processPrintJob(newJob.id);
        }
      })
      .subscribe((status) => {
        console.log('📡 PrintServer Spooler Realtime:', status);
        
        // Al conectar, procesar todos los pendientes que se quedaron colgados
        if (status === 'SUBSCRIBED') {
          supabase.from('print_jobs').select('id').eq('status', 'pending').then(({ data }) => {
            if (data) {
              data.forEach(job => processPrintJob(job.id));
            }
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(qzHeartbeat);
    };
  }, [t, formatCurrency]);

  return null;
}

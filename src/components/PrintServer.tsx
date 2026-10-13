import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { printKitchenRoutingDetailed, printMainTicket } from '../lib/printerService';
import { qzService } from '../lib/qzTray';

// Tiempo máximo por trabajo (amplio, pensado para una caja antigua).
// La comanda de cocina puede imprimir en varias impresoras seguidas, por eso tiene más margen.
const KITCHEN_JOB_TIMEOUT_MS = 60000;
const TICKET_JOB_TIMEOUT_MS = 35000;
// Un trabajo en 'processing' que nadie de esta pestaña está atendiendo y que lleva
// al menos este tiempo observado en ese estado se considera huérfano (pestaña cerrada/recargada).
const ORPHAN_PROCESSING_MS = 3 * 60 * 1000;

export function PrintServer() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();

  // t y formatCurrency cambian de identidad en cada render de sus proveedores.
  // Se guardan en refs para que el servidor de impresión NO se reinicie (canal, cola, timers)
  // cada vez que la app se vuelve a renderizar, lo que podía provocar impresiones simultáneas.
  const tRef = useRef(t);
  tRef.current = t;
  const formatCurrencyRef = useRef(formatCurrency);
  formatCurrencyRef.current = formatCurrency;

  useEffect(() => {
    // Verificar si somos el servidor de impresión
    const isPrintServer = localStorage.getItem('print_server_active') === 'true';
    if (!isPrintServer) return;

    let isMounted = true;
    console.log('🖨️ MODO SERVIDOR DE IMPRESIÓN ACTIVO (SPOOLER BLINDADO): Escuchando cola de impresión...');

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

    // Envoltorio con timeout para proteger la máquina antigua contra cuelgues eternos
    const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
      let timer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(errorMsg), { isTimeout: true })), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    // Actualiza el estado de un trabajo con reintentos (la red de una caja antigua puede fallar puntualmente).
    // Si no se consigue marcar, el trabajo quedaría en 'processing' y podría reimprimirse.
    const updateJob = async (jobId: string, patch: Record<string, any>): Promise<boolean> => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error } = await supabase.from('print_jobs').update(patch).eq('id', jobId);
          if (!error) return true;
          console.warn(`⚠️ [COLA] No se pudo actualizar el trabajo ${jobId} (intento ${attempt}/3):`, error);
        } catch (e) {
          console.warn(`⚠️ [COLA] Excepción actualizando el trabajo ${jobId} (intento ${attempt}/3):`, e);
        }
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
      return false;
    };

    // Trabajos que esta pestaña está procesando ahora mismo (el watchdog nunca debe tocarlos)
    const processingIds = new Set<string>();
    // Primera vez que el watchdog vio cada trabajo en 'processing' sin que esta pestaña lo atienda
    const firstSeenProcessing = new Map<string, number>();

    interface PrintOutcome {
      actualPrinter: string;
      printedAny: boolean;
      errorMessage: string | null;
    }

    // Procesamiento individual de un trabajo
    const processPrintJob = async (jobId: string) => {
      try {
        // Bloquear atómicamente el trabajo para evitar que otro proceso lo tome
        const { data: job, error: lockError } = await supabase
          .from('print_jobs')
          .update({ status: 'processing' })
          .eq('id', jobId)
          .eq('status', 'pending')
          .select()
          .maybeSingle();

        if (lockError || !job) {
          // El trabajo ya fue tomado o procesado
          return;
        }

        processingIds.add(jobId);

        // Descartar automáticamente trabajos antiguos (más de 15 minutos, p.ej. días u horas anteriores)
        if (job.created_at) {
          const ageMinutes = Math.round((Date.now() - new Date(job.created_at).getTime()) / 60000);
          if (ageMinutes > 15) {
            console.warn(`⚠️ [COLA] Omitiendo trabajo caducado (${ageMinutes} min de antigüedad): ${jobId}`);
            await updateJob(jobId, {
              status: 'failed',
              error_message: `Omitido automáticamente: Pedido atrasado (${ageMinutes} min de antigüedad)`
            });
            return;
          }
        }

        console.log(`🖨️ [COLA] Procesando trabajo de impresión [${job.ticket_type}]: ${jobId}`);

        const executePrinting = async (): Promise<PrintOutcome> => {
          const outcome: PrintOutcome = {
            actualPrinter: job.printer_target || '',
            printedAny: false,
            errorMessage: null
          };

          if (job.ticket_type === 'kitchen') {
            const deps = await loadDependencies();
            const result = await printKitchenRoutingDetailed({
              orderNum: job.content.orderNum,
              cartItems: job.content.cartItems,
              categories: deps.categories,
              tables: deps.tables,
              tableId: job.content.tableId,
              serviceType: job.content.serviceType || 'takeaway'
            });
            if (result.printed.length > 0) {
              outcome.actualPrinter = result.printed.join(', ');
              outcome.printedAny = true;
            }
            if (result.failed.length > 0) {
              outcome.errorMessage = `No se pudo imprimir en: ${result.failed.join(', ')}` +
                (result.printed.length > 0 ? ` (sí se imprimió en: ${result.printed.join(', ')})` : '');
            } else if (result.error) {
              outcome.errorMessage = `Error procesando la comanda: ${result.error}`;
            }
          } else if (job.ticket_type === 'invoice' || job.ticket_type === 'receipt') {
            const companyInfo = await loadCompanyInfo();
            const printed = await printMainTicket({
              ticketData: job.content.ticketData,
              companyInfo,
              formatCurrency: (amount: number) => formatCurrencyRef.current(amount),
              t: (key: string) => tRef.current(key)
            });
            outcome.actualPrinter = 'CAJA (Principal)';
            outcome.printedAny = printed;
            if (!printed) {
              outcome.errorMessage = 'No se pudo imprimir el ticket de caja (QZ Tray no disponible o impresora no encontrada).';
            }
          }

          return outcome;
        };

        const timeoutMs = job.ticket_type === 'kitchen' ? KITCHEN_JOB_TIMEOUT_MS : TICKET_JOB_TIMEOUT_MS;
        const outcome = await withTimeout(
          executePrinting(),
          timeoutMs,
          `Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s): la impresora física o QZ Tray tardaron demasiado.`
        );

        if (outcome.errorMessage) {
          console.warn(`⚠️ [COLA] Trabajo ${jobId} NO impreso correctamente: ${outcome.errorMessage}`);
          const patch: Record<string, any> = { status: 'failed', error_message: outcome.errorMessage };
          if (outcome.printedAny) patch.printer_target = outcome.actualPrinter;
          await updateJob(jobId, patch);
        } else {
          await updateJob(jobId, { status: 'completed', printer_target: outcome.actualPrinter || null });
          console.log(`✅ [COLA] Trabajo de impresión completado con éxito: ${jobId}`);
        }

      } catch (err: any) {
        console.error(`❌ [COLA] Error procesando trabajo de impresión ${jobId}:`, err);
        await updateJob(jobId, { status: 'failed', error_message: err?.message || 'Error desconocido o timeout' });

        // Si fue un timeout, QZ Tray puede haberse quedado bloqueado: se reinicia la conexión
        // para que el siguiente ticket no se cuelgue también.
        if (err?.isTimeout) {
          await qzService.resetConnection();
        }
      } finally {
        processingIds.delete(jobId);
      }
    };

    // COLA SECUENCIAL ESTRICTA (FIFO)
    // Garantiza que los tickets no colisionen jamás en QZ Tray y procesen 1 a 1
    const jobQueue: string[] = [];
    let isProcessingQueue = false;

    const processNextInQueue = async () => {
      if (isProcessingQueue || !isMounted || jobQueue.length === 0) return;

      isProcessingQueue = true;
      const nextJobId = jobQueue.shift()!;

      try {
        await processPrintJob(nextJobId);
      } catch (err) {
        console.error('Error no controlado en cola de impresión:', err);
      } finally {
        // Pausa de 700ms de respiro para que la CPU de la máquina vieja y el buffer liberen memoria
        await new Promise((resolve) => setTimeout(resolve, 700));
        isProcessingQueue = false;
        if (isMounted && jobQueue.length > 0) {
          processNextInQueue();
        }
      }
    };

    const enqueueJob = (jobId: string) => {
      if (!jobId || jobQueue.includes(jobId) || processingIds.has(jobId)) return;
      jobQueue.push(jobId);
      processNextInQueue();
    };

    // WATCHDOG / SONDEO DE RESPALDO (Cada 15 segundos)
    // Rescata pedidos si Supabase Realtime se desconecta o si hay trabajos huérfanos
    let watchdogRunning = false;
    const checkPendingAndStuckJobs = async () => {
      if (!isMounted || watchdogRunning) return;
      watchdogRunning = true;
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        // 1. Limpiar y marcar como descartados todos los pendientes antiguos (>15 min)
        // para evitar imprimir tickets acumulados de días u horas anteriores
        await supabase
          .from('print_jobs')
          .update({
            status: 'failed',
            error_message: 'Descartado automáticamente: Pedido atrasado de sesión anterior (>15 min)'
          })
          .eq('status', 'pending')
          .lt('created_at', fifteenMinutesAgo);

        // 2. Rescatar solo pendientes recientes (< 15 minutos) que Realtime pudiera haber omitido
        const { data: pendingJobs } = await supabase
          .from('print_jobs')
          .select('id')
          .eq('status', 'pending')
          .gte('created_at', fifteenMinutesAgo)
          .order('created_at', { ascending: true })
          .limit(20);

        if (pendingJobs && pendingJobs.length > 0) {
          pendingJobs.forEach((job) => enqueueJob(job.id));
        }

        // 2. Rescatar trabajos huérfanos en 'processing' (p.ej. pestaña cerrada o recargada a mitad).
        //    Solo se consideran huérfanos si esta pestaña NO los está atendiendo y llevan
        //    ORPHAN_PROCESSING_MS observados en ese estado.
        const { data: processingJobs } = await supabase
          .from('print_jobs')
          .select('id')
          .eq('status', 'processing')
          .limit(20);

        const now = Date.now();
        const currentIds = new Set((processingJobs || []).map((j) => j.id));
        for (const knownId of Array.from(firstSeenProcessing.keys())) {
          if (!currentIds.has(knownId)) firstSeenProcessing.delete(knownId);
        }

        for (const pj of processingJobs || []) {
          if (processingIds.has(pj.id)) {
            firstSeenProcessing.delete(pj.id);
            continue;
          }
          const firstSeen = firstSeenProcessing.get(pj.id);
          if (firstSeen === undefined) {
            firstSeenProcessing.set(pj.id, now);
            continue;
          }
          if (now - firstSeen >= ORPHAN_PROCESSING_MS) {
            console.warn(`⚠️ [WATCHDOG] Rescatando trabajo huérfano en 'processing': ${pj.id}`);
            firstSeenProcessing.delete(pj.id);
            const { data: rescued } = await supabase
              .from('print_jobs')
              .update({ status: 'pending', error_message: 'Reiniciado por Watchdog tras tiempo excesivo' })
              .eq('id', pj.id)
              .eq('status', 'processing')
              .select('id');
            if (rescued && rescued.length > 0) {
              enqueueJob(pj.id);
            }
          }
        }
      } catch (err) {
        console.warn('Advertencia en Watchdog de impresión:', err);
      } finally {
        watchdogRunning = false;
      }
    };

    const watchdogInterval = setInterval(checkPendingAndStuckJobs, 15000);

    // CANAL REALTIME (Para impresión inmediata)
    const channel = supabase.channel('print_server_spooler')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs', filter: "status=eq.pending" }, (payload) => {
        const newJob = payload.new;
        if (newJob?.id) {
          enqueueJob(newJob.id);
        }
      })
      .subscribe((status) => {
        console.log('📡 PrintServer Spooler Realtime:', status);
        if (status === 'SUBSCRIBED') {
          checkPendingAndStuckJobs();
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      clearInterval(qzHeartbeat);
      clearInterval(watchdogInterval);
    };
  }, []);

  return null;
}

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Calendar, DollarSign, Filter, RefreshCw, Printer, Users, ChevronDown, ChevronUp, ShoppingBag, CheckCircle, UserCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CashSession {
  id: string;
  employee_id: string;
  opening_amount: number;
  opened_at: string;
  closing_amount: number | null;
  closed_at: string | null;
  status: 'open' | 'closed';
  notes: string | null;
  employee_profiles?: { full_name: string };
}

interface CashWithdrawal {
  id: string;
  session_id: string;
  amount: number;
  reason: string;
  withdrawn_by: string;
  withdrawn_at: string;
  notes: string | null;
}

interface Order {
  id: string;
  total: number;
  created_at: string;
  status: string;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    products: { name: string }[];
  }>;
}

interface WaiterReport {
  employeeId: string;
  employeeName: string;
  role: string;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSales: number;
  orders: Array<{
    id: string;
    order_number: number | null;
    created_at: string;
    total: number;
    status: string;
    tableName?: string | null;
    itemsSummary?: string;
  }>;
}

export function CashRegisterDashboard() {
  const { user, profile } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const { formatCurrency: formatCurrencyFromContext } = useCurrency();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'waiters'>('sessions');
  const [waiterReports, setWaiterReports] = useState<WaiterReport[]>([]);
  const [loadingWaiters, setLoadingWaiters] = useState(false);
  const [expandedWaiterId, setExpandedWaiterId] = useState<string | null>(null);

  // Estados de filtro de fecha para Ventas por Camarero
  const [waiterDate, setWaiterDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [waiterFilterMode, setWaiterFilterMode] = useState<'day' | 'range'>('day');
  const [waiterStartDate, setWaiterStartDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [waiterEndDate, setWaiterEndDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [waiterSearchTerm, setWaiterSearchTerm] = useState('');

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all' as 'all' | 'open' | 'closed',
    employeeId: 'all' as string,
  });

  const [employees, setEmployees] = useState<Array<{ id: string, full_name: string }>>([]);

  const [totals, setTotals] = useState({
    totalOpening: 0,
    totalSales: 0,
    totalWithdrawals: 0,
    totalClosing: 0,
    balance: 0,
  });

  const [currentCashStatus, setCurrentCashStatus] = useState({
    currentAmount: 0,
    lastSessionStatus: 'closed' as 'open' | 'closed',
    lastSessionTime: '',
  });

  const [dailySessions, setDailySessions] = useState<any[]>([]);

  // Estados para retiros de caja
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedSessionForWithdrawal, setSelectedSessionForWithdrawal] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [withdrawals, setWithdrawals] = useState<CashWithdrawal[]>([]);

  useEffect(() => {
    fetchSessions();
    fetchCurrentCashStatus();
    fetchWithdrawals();
    if (activeTab === 'waiters') {
      fetchWaiterReports();
    }
  }, [filters, profile, activeTab, waiterDate, waiterStartDate, waiterEndDate, waiterFilterMode]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      groupSessionsByDay();
    }
  }, [sessions]);

  useEffect(() => {
    checkAutoClose();
    const interval = setInterval(checkAutoClose, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Suscripción en tiempo real a órdenes, sesiones y retiros para reflejar cambios en directo
  useEffect(() => {
    const channel = supabase
      .channel('cash-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchSessions();
          fetchCurrentCashStatus();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_register_sessions' },
        () => {
          fetchSessions();
          fetchCurrentCashStatus();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_withdrawals' },
        () => {
          fetchWithdrawals();
          fetchSessions();
          fetchCurrentCashStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAutoClose = async () => {
    const now = new Date();
    const currentHour = now.getHours();

    // Only run this logic if it's past 2 AM
    if (currentHour >= 2) {
      const { data: openSessions } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('status', 'open');

      if (openSessions && openSessions.length > 0) {
        for (const session of openSessions) {
          const openTime = new Date(session.opened_at);
          const today2AM = new Date();
          today2AM.setHours(2, 0, 0, 0);

          // If session opened before today's 2 AM boundary (e.g. yesterday)
          if (openTime < today2AM) {
            // Calculate expected totals
            // Need to fetch sales and withdrawals for this specific session
            // Approximate logic:
            const { data: sales } = await supabase.from('orders').select('total').eq('employee_id', session.employee_id).gte('created_at', session.opened_at).eq('status', 'completed');
            const totalSales = (sales || []).reduce((acc, curr) => acc + curr.total, 0);

            const { data: wdraws } = await supabase.from('cash_withdrawals').select('amount').eq('session_id', session.id);
            const totalWithdrawals = (wdraws || []).reduce((acc, curr) => acc + curr.amount, 0);

            const expected = (session.opening_amount || 0) + totalSales - totalWithdrawals;

            await supabase.from('cash_register_sessions').update({
              status: 'closed',
              closed_at: new Date().toISOString(),
              closing_amount: expected,
              notes: 'Auto-cierre 02:00 AM (Sistema)'
            }).eq('id', session.id);

            toast('Sesión cerrada automáticamente (02:00 AM)', { icon: '🌙' });
          }
        }
        // Refresh if we closed anything
        fetchSessions();
      }
    }
  };

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('cash_register_sessions')
        .select(`
          *,
          employee_profiles!inner(full_name, role)
        `)
        .neq('employee_profiles.role', 'super_admin') // Ocultar sesiones de super_admin
        .order('opened_at', { ascending: false });

      // Para cajeros: solo sus sesiones y solo del día actual (hora local)
      if (profile?.role === 'cashier') {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        query = query
          .eq('employee_id', user.id)
          .gte('opened_at', `${today}T00:00:00`)
          .lte('opened_at', `${today}T23:59:59.999Z`);
      } else {
        // Para administradores: aplicar filtros
        if (filters.startDate) {
          query = query.gte('opened_at', `${filters.startDate}T00:00:00`);
        }
        if (filters.endDate) {
          query = query.lte('opened_at', `${filters.endDate}T23:59:59.999Z`);
        }
        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters.employeeId !== 'all') {
          query = query.eq('employee_id', filters.employeeId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      setSessions(data || []);

      // Calcular totales preliminares (se sincronizan con ventas y retiros en groupSessionsByDay)
      const totalOpening = (data || []).reduce((sum, s) => sum + (s.opening_amount || 0), 0);
      const totalClosing = (data || []).reduce((sum, s) => sum + (s.closing_amount || 0), 0);
      setTotals(prev => ({
        ...prev,
        totalOpening,
        totalClosing,
      }));
    } catch (err) {
      console.error('Error fetching cash sessions:', err);
      toast.error(t('Error al cargar sesiones de caja'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Usar formatCurrency del contexto global
  const formatCurrency = formatCurrencyFromContext;

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('id, full_name')
        .neq('role', 'super_admin') // Ocultar super_admin
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_withdrawals')
        .select('*')
        .order('withdrawn_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
    }
  };

  const registerWithdrawal = async () => {
    if (!selectedSessionForWithdrawal || !withdrawalAmount || !withdrawalReason) {
      toast.error(t('Por favor completa todos los campos obligatorios'));
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_withdrawals')
        .insert({
          session_id: selectedSessionForWithdrawal,
          amount: parseFloat(withdrawalAmount),
          reason: withdrawalReason,
          withdrawn_by: user!.id,
          notes: withdrawalNotes || null
        });

      if (error) throw error;

      toast.success(t('Retiro registrado exitosamente'));
      setShowWithdrawalModal(false);
      setWithdrawalAmount('');
      setWithdrawalReason('');
      setWithdrawalNotes('');
      setSelectedSessionForWithdrawal(null);

      // Recargar datos
      fetchWithdrawals();
      fetchSessions();
    } catch (err) {
      console.error('Error registering withdrawal:', err);
      toast.error(t('Error al registrar el retiro'));
    }
  };

  const fetchCurrentCashStatus = async () => {
    try {
      // Obtener la sesión más reciente del usuario (o de cualquiera para admin)
      let query = supabase
        .from('cash_register_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (profile?.role === 'cashier' && user) {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const latestSession = data[0];
        const sessionStart = latestSession.opened_at;
        const sessionEnd = latestSession.closed_at || new Date().toISOString();

        // Ventas completadas durante esta sesión
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('total')
          .eq('status', 'completed')
          .gte('created_at', sessionStart)
          .lte('created_at', sessionEnd);

        const liveSales = (sessionOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);

        // Retiros durante esta sesión
        const { data: sessionWithdrawals } = await supabase
          .from('cash_withdrawals')
          .select('amount')
          .eq('session_id', latestSession.id);

        const liveWithdrawals = (sessionWithdrawals || []).reduce((sum, w) => sum + (w.amount || 0), 0);

        // Dinero en directo en caja:
        let currentAmount = (latestSession.opening_amount || 0) + liveSales - liveWithdrawals;
        // Si está cerrada con un monto de cierre explícito > 0, usar closing_amount
        if (latestSession.status === 'closed' && latestSession.closing_amount !== null && latestSession.closing_amount !== undefined && latestSession.closing_amount > 0) {
          currentAmount = latestSession.closing_amount;
        }

        setCurrentCashStatus({
          currentAmount,
          lastSessionStatus: latestSession.status,
          lastSessionTime: latestSession.status === 'open' ? latestSession.opened_at : (latestSession.closed_at || latestSession.opened_at),
        });
      } else {
        // No sessions found
        setCurrentCashStatus({
          currentAmount: 0,
          lastSessionStatus: 'closed',
          lastSessionTime: '',
        });
      }
    } catch (err) {
      console.error('Error fetching current cash status:', err);
      setCurrentCashStatus({
        currentAmount: 0,
        lastSessionStatus: 'closed',
        lastSessionTime: '',
      });
    }
  };

  const groupSessionsByDay = async () => {
    const grouped = sessions.reduce((acc: Record<string, any>, session) => {
      const date = new Date(session.opened_at).toDateString();
      const employeeKey = `${date}-${session.employee_id}`;

      if (!acc[employeeKey]) {
        acc[employeeKey] = {
          date,
          employee_id: session.employee_id,
          employee_profiles: session.employee_profiles,
          sessions: [],
          totalOpening: 0,
          totalClosing: 0,
          totalSales: 0,
          totalWithdrawals: 0,
          expectedClosing: 0,
          difference: 0,
          firstOpen: session.opened_at,
          lastClose: session.closed_at,
          hasOpenSession: false,
        };
      }
      acc[employeeKey].sessions.push(session);
      acc[employeeKey].totalOpening += (session.opening_amount || 0);
      if (session.status === 'open' || !session.closed_at) {
        acc[employeeKey].hasOpenSession = true;
      }
      if (session.closing_amount !== null && session.closing_amount !== undefined) {
        acc[employeeKey].totalClosing += Number(session.closing_amount);
      }
      if (new Date(session.opened_at) < new Date(acc[employeeKey].firstOpen)) {
        acc[employeeKey].firstOpen = session.opened_at;
      }
      if (session.closed_at && (!acc[employeeKey].lastClose || new Date(session.closed_at) > new Date(acc[employeeKey].lastClose))) {
        acc[employeeKey].lastClose = session.closed_at;
      }
      return acc;
    }, {} as Record<string, any>);

    // Calcular ventas y retiros para cada día
    for (const employeeKey of Object.keys(grouped)) {
      const dayData = grouped[employeeKey];
      const startOfDay = new Date(dayData.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dayData.date);
      endOfDay.setHours(23, 59, 59, 999);

      // Obtener todas las ventas completadas del día (todas las ventas van a la caja)
      const { data: orders } = await supabase
        .from('orders')
        .select('total')
        .eq('status', 'completed')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      dayData.totalSales = (orders || []).reduce((sum, order) => sum + (order.total || 0), 0);

      // Obtener retiros del día
      const sessionIds = dayData.sessions.map((s: CashSession) => s.id);
      const { data: dayWithdrawals } = await supabase
        .from('cash_withdrawals')
        .select('amount')
        .in('session_id', sessionIds);

      dayData.totalWithdrawals = (dayWithdrawals || []).reduce((sum, w) => sum + (w.amount || 0), 0);

      // Calcular cierre esperado y diferencia
      // Cierre esperado = Apertura + Ventas - Retiros
      dayData.expectedClosing = dayData.totalOpening + dayData.totalSales - dayData.totalWithdrawals;
      
      // Si hay una sesión abierta en curso, la diferencia se marca como en curso (0)
      if (dayData.hasOpenSession) {
        dayData.difference = 0;
      } else {
        // Diferencia = Cierre Real - Cierre Esperado
        dayData.difference = dayData.totalClosing - dayData.expectedClosing;
      }
    }

    const dailyArray = Object.values(grouped).sort((a: any, b: any) => {
      // Sort by date desc, then by employee name
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (a.employee_profiles?.full_name || '').localeCompare(b.employee_profiles?.full_name || '');
    });
    setDailySessions(dailyArray);

    // Actualizar totales globales en directo para las tarjetas superiores
    const totalOpening = dailyArray.reduce((sum: number, d: any) => sum + (d.totalOpening || 0), 0);
    const totalSales = dailyArray.reduce((sum: number, d: any) => sum + (d.totalSales || 0), 0);
    const totalWithdrawals = dailyArray.reduce((sum: number, d: any) => sum + (d.totalWithdrawals || 0), 0);
    const totalClosing = dailyArray.reduce((sum: number, d: any) => sum + (d.totalClosing || 0), 0);
    const balance = totalOpening + totalSales - totalWithdrawals;

    setTotals({
      totalOpening,
      totalSales,
      totalWithdrawals,
      totalClosing,
      balance,
    });
  };

  const printDailyReport = async (day: any) => {
    try {
      // Fetch orders for the entire day
      const startOfDay = new Date(day.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day.date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          order_number,
          created_at,
          status,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .eq('status', 'completed');

      if (error) throw error;

      // Calculate order totals
      const fetchedTotal = (orders || []).reduce((sum, order) => sum + (order.total || 0), 0);
      const orderTotal = fetchedTotal > 0 ? fetchedTotal : (day.totalSales || 0);
      const orderCount = orders?.length || 0;

      // Create professional invoice-style print content in French
      const printContent = `
        <div class="report">
          <div class="header">
            <h1>LIN-Caisse</h1>
            <p>Système de Gestion Intégré</p>
            <p>Rapport Journalier de Caisse</p>
          </div>

          <div class="info-section">
            <div class="info-item">
              <strong>${new Date(day.date).toLocaleDateString('fr-FR')}</strong>
              <span>Date du Rapport</span>
            </div>
            <div class="info-item">
              <strong>${profile?.role === 'admin' || profile?.role === 'super_admin' ? (day.employee_profiles?.full_name || profile?.full_name || 'Caissier') : (profile?.full_name || 'Vous')}</strong>
              <span>Employé</span>
            </div>
            <div class="info-item">
              <strong>${orderCount}</strong>
              <span>Total Commandes</span>
            </div>
            <div class="info-item">
              <strong>${formatCurrency(orderTotal)}</strong>
              <span>Ventes Totales</span>
            </div>
          </div>

          <div class="section-title">RÉSUMÉ FINANCIER DU JOUR</div>
          <div class="summary-grid">
            <div class="summary-item">
              <strong>${formatCurrency(day.totalOpening)}</strong>
              <span>Fond de Caisse Initial</span>
            </div>
            <div class="summary-item">
              <strong>${formatCurrency(day.totalClosing)}</strong>
              <span>Fond de Caisse Final</span>
            </div>
            <div class="summary-item">
              <strong>${formatCurrency(day.totalClosing - day.totalOpening)}</strong>
              <span>Solde du Jour</span>
            </div>
            <div class="summary-item">
              <strong>${day.sessions.length}</strong>
              <span>Sessions de Caisse</span>
            </div>
          </div>

          <div class="section-title">DÉTAIL DES SESSIONS</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Heure Ouverture</th>
                  <th>Montant Initial</th>
                  <th>Heure Fermeture</th>
                  <th>Montant Final</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                ${day.sessions.map((session: CashSession, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${formatCurrency(session.opening_amount)}</td>
                    <td>${session.closed_at ? new Date(session.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>${session.closing_amount ? formatCurrency(session.closing_amount) : '-'}</td>
                    <td>${session.closed_at ? 'Fermée' : 'Ouverte'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section-title">DÉTAIL DES COMMANDES</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>N° Commande</th>
                  <th>Heure</th>
                  <th>Produits</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(orders || []).map(order => `
                  <tr>
                    <td>${order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8)}</td>
                    <td>${new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${order.order_items.map(item => `${item.quantity}x ${item.products[0]?.name || 'Produit'}`).join(', ')}</td>
                    <td>${formatCurrency(order.total)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right; font-weight: bold;">TOTAL DU JOUR</td>
                  <td style="font-weight: bold; font-size: 16px;">${formatCurrency(orderTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <p>Signature de l'Employé</p>
              <p>${profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : profile?.full_name || 'Utilisateur'}</p>
            </div>
            <div class="signature-box">
              <p>Signature de l'Administrateur</p>
            </div>
          </div>

          <div class="footer">
            <p>Ce document est officiel et fait partie de la comptabilité de LIN-Caisse</p>
            <p>Rapport généré le ${new Date().toLocaleString('fr-FR')}</p>
          </div>
        </div>
      `;

      // Print in professional invoice format
      const printWindow = window.open('', '', 'height=800,width=1000');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reporte Diario de Caja</title>
              <style>
                body {
                  font-family: 'Arial', sans-serif;
                  margin: 0;
                  padding: 20px;
                  background: white;
                }
                .report {
                  max-width: 210mm;
                  margin: 0 auto;
                  padding: 20px;
                  background: white;
                  box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                  text-align: center;
                  border-bottom: 2px solid #333;
                  padding-bottom: 20px;
                  margin-bottom: 30px;
                }
                .header h1 {
                  color: #333;
                  margin: 0;
                  font-size: 28px;
                }
                .header p {
                  color: #666;
                  margin: 5px 0;
                  font-size: 14px;
                }
                .info-section {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 30px;
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 8px;
                }
                .info-item {
                  flex: 1;
                  text-align: center;
                }
                .info-item strong {
                  display: block;
                  font-size: 18px;
                  color: #333;
                  margin-bottom: 5px;
                }
                .info-item span {
                  color: #666;
                  font-size: 14px;
                }
                .section-title {
                  font-size: 16px;
                  font-weight: bold;
                  color: #333;
                  margin: 20px 0 10px 0;
                  padding-bottom: 5px;
                  border-bottom: 1px solid #ddd;
                }
                .summary-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 15px;
                  margin: 20px 0;
                }
                .summary-item {
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                }
                .summary-item strong {
                  display: block;
                  font-size: 20px;
                  color: #333;
                  margin-bottom: 5px;
                }
                .summary-item span {
                  color: #666;
                  font-size: 14px;
                }
                .table-container {
                  margin: 20px 0;
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  overflow: hidden;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                }
                th, td {
                  padding: 10px 12px;
                  text-align: left;
                  border-bottom: 1px solid #ddd;
                }
                th {
                  background: #f8f9fa;
                  font-weight: bold;
                  color: #333;
                }
                .total-row {
                  background: #e9ecef;
                  font-weight: bold;
                }
                .footer {
                  margin-top: 40px;
                  text-align: center;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  color: #666;
                  font-size: 12px;
                }
                .signature-section {
                  margin-top: 40px;
                  display: flex;
                  justify-content: space-between;
                }
                .signature-box {
                  width: 200px;
                  text-align: center;
                  border-top: 1px solid #333;
                  padding-top: 10px;
                }
                @media print {
                  body {
                    background: white !important;
                    -webkit-print-color-adjust: exact;
                  }
                  .report {
                    box-shadow: none;
                    margin: 0;
                    padding: 15mm;
                  }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    } catch (err) {
      console.error('Error generating daily report:', err);
      toast.error(t('Error al generar el reporte diario'));
    }
  };

  const printSessionReport = async (session: CashSession) => {
    try {
      // Fetch orders for this session's date range
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          status,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .gte('created_at', session.opened_at)
        .lte('created_at', session.closed_at || new Date().toISOString())
        .eq('status', 'completed');

      if (error) throw error;

      // Calculate order totals
      const orderTotal = (orders || []).reduce((sum, order) => sum + (order.total || 0), 0);
      const orderCount = orders?.length || 0;

      // Create print content in French
      const printContent = `
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px;">
          <h2 style="text-align: center; margin-bottom: 10px;">RAPPORT DE CAISSE</h2>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>Employé:</strong> ${profile?.role === 'admin' || profile?.role === 'super_admin' ? (session.employee_profiles?.full_name || profile?.full_name || 'Caissier') : (profile?.full_name || 'Vous')}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Date d'Ouverture:</strong> ${formatDate(session.opened_at)}
          </div>

          ${session.closed_at ? `<div style="margin-bottom: 10px;">
            <strong>Date de Fermeture:</strong> ${formatDate(session.closed_at)}
          </div>` : ''}

          <div style="margin-bottom: 10px;">
            <strong>Montant Initial:</strong> ${formatCurrency(session.opening_amount)}
          </div>

          ${session.closing_amount ? `<div style="margin-bottom: 10px;">
            <strong>Montant Final:</strong> ${formatCurrency(session.closing_amount)}
          </div>` : ''}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RÉSUMÉ DES COMMANDES</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Commandes:</strong> ${orderCount}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Ventes Totales:</strong> ${formatCurrency(orderTotal)}
          </div>

          ${session.closing_amount ? `<div style="margin-bottom: 10px;">
            <strong>Solde:</strong> ${formatCurrency(session.closing_amount - session.opening_amount)}
          </div>` : ''}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>DÉTAIL DES COMMANDES</strong>
          </div>

          ${(orders || []).map(order => `
            <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
              <div><strong>Commande #${order.id.slice(-8)}</strong></div>
              <div>Heure: ${new Date(order.created_at).toLocaleTimeString('fr-FR')}</div>
              <div>Total: ${formatCurrency(order.total)}</div>
              <div style="font-size: 12px; margin-top: 3px;">
                ${order.order_items.map(item => `${item.quantity}x ${item.products[0]?.name || 'Produit'}`).join(', ')}
              </div>
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            Généré le ${new Date().toLocaleString('fr-FR')}
          </div>
        </div>
      `;

      // Print directly without opening new window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Rapport de Caisse</title>
              <style>
                @media print {
                  body { margin: 0; }
                  @page { size: auto; margin: 5mm; }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        // Close window after printing
        printWindow.onafterprint = () => printWindow.close();
      }
    } catch (err) {
      console.error('Error generating session report:', err);
      toast.error(t('Error al generar el reporte'));
    }
  };

  const shiftWaiterDate = (days: number) => {
    const d = new Date(waiterDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setWaiterDate(`${year}-${month}-${day}`);
    setWaiterFilterMode('day');
  };

  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setWaiterDateToToday = () => {
    setWaiterDate(getTodayStr());
    setWaiterFilterMode('day');
  };

  const setWaiterDateToYesterday = () => {
    setWaiterDate(getYesterdayStr());
    setWaiterFilterMode('day');
  };

  const isWaiterDateToday = waiterFilterMode === 'day' && waiterDate === getTodayStr();
  const isWaiterDateYesterday = waiterFilterMode === 'day' && waiterDate === getYesterdayStr();

  const getFormattedWaiterFilterLabel = () => {
    const locale = currentLanguage === 'fr' ? 'fr-FR' : 'es-ES';
    if (waiterFilterMode === 'day') {
      const d = new Date(waiterDate + 'T12:00:00');
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      const d1 = new Date(waiterStartDate + 'T12:00:00').toLocaleDateString(locale);
      const d2 = new Date(waiterEndDate + 'T12:00:00').toLocaleDateString(locale);
      return `${d1} - ${d2}`;
    }
  };

  const fetchWaiterReports = async () => {
    setLoadingWaiters(true);
    try {
      const { data: employeesData, error: empErr } = await supabase
        .from('employee_profiles')
        .select('id, full_name, role')
        .neq('role', 'super_admin')
        .order('full_name');

      if (empErr) throw empErr;

      let startDateIso: string;
      let endDateIso: string;

      if (waiterFilterMode === 'day') {
        startDateIso = `${waiterDate}T00:00:00`;
        endDateIso = `${waiterDate}T23:59:59.999Z`;
      } else {
        startDateIso = `${waiterStartDate}T00:00:00`;
        endDateIso = `${waiterEndDate}T23:59:59.999Z`;
      }

      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          status,
          created_at,
          employee_id,
          tables (name),
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .gte('created_at', startDateIso)
        .lte('created_at', endDateIso)
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;

      const reportsMap = new Map<string, WaiterReport>();

      (employeesData || []).forEach(emp => {
        reportsMap.set(emp.id, {
          employeeId: emp.id,
          employeeName: emp.full_name || 'Empleado',
          role: emp.role || 'camarero',
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          totalSales: 0,
          orders: [],
        });
      });

      (ordersData || []).forEach((ord: any) => {
        if (!ord.employee_id) return;

        let report = reportsMap.get(ord.employee_id);
        if (!report) {
          report = {
            employeeId: ord.employee_id,
            employeeName: 'Empleado sin perfil',
            role: 'waiter',
            totalOrders: 0,
            completedOrders: 0,
            pendingOrders: 0,
            totalSales: 0,
            orders: [],
          };
          reportsMap.set(ord.employee_id, report);
        }

        const orderTotal = typeof ord.total === 'string' ? parseFloat(ord.total) : (ord.total || 0);
        report.totalOrders += 1;
        if (ord.status === 'completed') {
          report.completedOrders += 1;
          report.totalSales += orderTotal;
        } else if (ord.status !== 'cancelled') {
          report.pendingOrders += 1;
        }

        const itemsSummary = (ord.order_items || [])
          .map((i: any) => `${i.quantity}x ${Array.isArray(i.products) ? i.products[0]?.name : i.products?.name || 'Item'}`)
          .join(', ');

        report.orders.push({
          id: ord.id,
          order_number: ord.order_number,
          created_at: ord.created_at,
          total: orderTotal,
          status: ord.status,
          tableName: ord.tables ? (Array.isArray(ord.tables) ? ord.tables[0]?.name : ord.tables?.name) : null,
          itemsSummary,
        });
      });

      const result = Array.from(reportsMap.values())
        .filter(r => r.totalOrders > 0 || profile?.role === 'admin' || profile?.role === 'super_admin')
        .sort((a, b) => b.totalSales - a.totalSales);

      setWaiterReports(result);
    } catch (err) {
      console.error('Error al generar reporte de camareros:', err);
      toast.error(t('Error al cargar reporte de camareros'));
    } finally {
      setLoadingWaiters(false);
    }
  };

  const printWaiterReportTicket = (report: WaiterReport) => {
    const ticketContent = `
      <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px;">
        <h2 style="text-align: center; margin-bottom: 5px;">LIN-Caisse</h2>
        <h3 style="text-align: center; margin: 0 0 10px 0; font-size: 14px;">RAPPORT DE SERVEUR</h3>
        <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

        <div style="margin-bottom: 5px;">
          <strong>Serveur:</strong> ${report.employeeName}
        </div>
        <div style="margin-bottom: 5px;">
          <strong>Rôle:</strong> ${report.role}
        </div>
        <div style="margin-bottom: 5px;">
          <strong>Période:</strong> ${getFormattedWaiterFilterLabel()}
        </div>
        <div style="margin-bottom: 10px;">
          <strong>Date d'Émission:</strong> ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

        <div style="margin-bottom: 5px;">
          <strong>Total Commandes:</strong> ${report.totalOrders}
        </div>
        <div style="margin-bottom: 5px; color: green;">
          <strong>Encaissées:</strong> ${report.completedOrders}
        </div>
        <div style="margin-bottom: 5px; color: orange;">
          <strong>En attente:</strong> ${report.pendingOrders}
        </div>

        <div style="margin-bottom: 10px; padding: 8px; background-color: #e8f5e9; border: 1px solid #4caf50; font-size: 16px;">
          <strong>TOTAL VENTES:</strong> ${formatCurrency(report.totalSales)}
        </div>

        <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>
        <div style="margin-bottom: 10px; font-weight: bold;">DÉTAIL DES COMMANDES:</div>

        ${report.orders.map(ord => `
          <div style="margin-bottom: 6px; border-bottom: 1px dashed #ccc; padding-bottom: 4px; font-size: 12px;">
            <div><strong>#${ord.order_number ? String(ord.order_number).padStart(3, '0') : ord.id.slice(-6)}</strong> - ${new Date(ord.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (${ord.tableName ? 'Table ' + ord.tableName : 'À emporter'})</div>
            <div>Statut: ${ord.status === 'completed' ? 'PAYÉE' : 'EN ATTENTE'}</div>
            <div style="font-weight: bold;">Total: ${formatCurrency(ord.total)}</div>
          </div>
        `).join('')}

        <div style="border-bottom: 1px solid #000; margin: 15px 0;"></div>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 45%; padding-top: 4px;">
            Signature Serveur
          </div>
          <div style="text-align: center; border-top: 1px solid #000; width: 45%; padding-top: 4px;">
            Signature Caissier
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
          LIN-Caisse - Généré le ${new Date().toLocaleString('fr-FR')}
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Reporte Camarero - ${report.employeeName}</title>
            <style>
              @media print {
                body { margin: 0; }
                @page { size: auto; margin: 5mm; }
              }
            </style>
          </head>
          <body>
            ${ticketContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }
  };

  return (
    <div className="p-3 sm:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{t('Gestión de Caja')}</h1>
          <p className="text-xs sm:text-sm text-gray-600">{t('Historial de aperturas, cierres y resumen por camarero')}</p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex w-full sm:w-auto gap-1.5 bg-gray-200 p-1 rounded-2xl shadow-inner">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 sm:flex-initial px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 text-center ${
              activeTab === 'sessions'
                ? 'bg-white text-amber-700 shadow-md scale-102'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            💵 {t('Sesiones de Caja')}
          </button>
          <button
            onClick={() => {
              setActiveTab('waiters');
              fetchWaiterReports();
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 text-center ${
              activeTab === 'waiters'
                ? 'bg-white text-amber-700 shadow-md scale-102'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            👔 {t('Ventas por Camarero')}
          </button>
        </div>
      </div>

      {activeTab === 'sessions' ? (
        <>
          {/* Totales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-gray-700">{t('Total Aperturas')}</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalOpening)}</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-gray-700">{t('Total Ventas')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalSales)}</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-gray-700">{t('Total Cierres')}</span>
              </div>
              <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totals.totalClosing)}</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-gray-700">{t('Balance')}</span>
              </div>
              <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.balance)}
              </p>
              {totals.totalWithdrawals > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  - {formatCurrency(totals.totalWithdrawals)} {t('Retiros')}
                </p>
              )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{t('Estado Actual')}</span>
                </div>
                {currentCashStatus.lastSessionStatus === 'open' && (
                  <span className="flex h-2.5 w-2.5 relative" title="En Directo">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(currentCashStatus.currentAmount)}</p>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-medium ${
                  currentCashStatus.lastSessionStatus === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {currentCashStatus.lastSessionStatus === 'open' ? t('Caja Abierta') : t('Caja Cerrada')}
                </span>
                {currentCashStatus.lastSessionTime && (
                  <span className="text-gray-500 truncate">
                    {new Date(currentCashStatus.lastSessionTime).toLocaleString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filtros */}
          {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{t('Filtros')}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fecha Inicio')}</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fecha Fin')}</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Estado')}</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="all">{t('Todos')}</option>
                    <option value="open">{t('Abiertas')}</option>
                    <option value="closed">{t('Cerradas')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Empleado')}</label>
                  <select
                    value={filters.employeeId}
                    onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="all">{t('Todos los empleados')}</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchSessions}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('Actualizar')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Para cajeros: mostrar solo el día actual */}
          {profile?.role === 'cashier' && (
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{t('Sesiones de Hoy')}</span>
              </div>
              <div className="text-sm text-gray-600">
                {t('Mostrando todas tus sesiones de caja del día actual')}
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">{t('Cargando sesiones...')}</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t('No hay sesiones de caja para mostrar')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Empleado')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Fecha')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Primera Apertura')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Último Cierre')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Apertura')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Ventas')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Retiros')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Cierre Esperado')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Cierre Real')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Diferencia')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Acciones')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailySessions.map((day: any) => (
                      <tr key={`${day.date}-${day.employee_id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : t('Tú')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(day.date).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(day.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.lastClose ? new Date(day.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                          {formatCurrency(day.totalOpening)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(day.totalSales || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                          {formatCurrency(day.totalWithdrawals || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {formatCurrency(day.expectedClosing || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                          {day.hasOpenSession ? (
                            <span className="text-amber-600 font-normal italic">
                              {day.totalClosing > 0 ? `${formatCurrency(day.totalClosing)} (${t('En curso')})` : t('En curso')}
                            </span>
                          ) : (
                            formatCurrency(day.totalClosing || 0)
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                          {day.hasOpenSession ? (
                            <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs">
                              {t('En curso')}
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded ${Math.abs(day.difference) < 0.01 ? 'bg-green-100 text-green-700' :
                              day.difference > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {formatCurrency(day.difference || 0)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => printDailyReport(day)}
                              className="text-amber-600 hover:text-amber-900 p-1 rounded-md hover:bg-amber-50 transition-colors"
                              title={t('Imprimir reporte diario')}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {(profile?.role === 'admin' || profile?.role === 'super_admin') && day.sessions.length > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedSessionForWithdrawal(day.sessions[0].id);
                                  setShowWithdrawalModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors text-xs"
                                title={t('Registrar retiro de caja')}
                              >
                                {t('Retiro')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Header & Refresh de Ventas por Camarero */}
          <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                {t('Resumen de Ventas por Camarero')}
              </h2>
              <p className="text-sm text-gray-500">
                {t('Revise los pedidos de cada camarero e imprima su ticket individual de cierre')}
              </p>
            </div>
            <button
              onClick={fetchWaiterReports}
              disabled={loadingWaiters}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingWaiters ? 'animate-spin' : ''}`} />
              {t('Actualizar')}
            </button>
          </div>

          {/* Filtro de Calendario Día/Mes/Año para Camareros */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Controles de Navegación por Fecha */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Botón día anterior */}
                <button
                  onClick={() => shiftWaiterDate(-1)}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                  title={t('Día anterior')}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('Anterior')}</span>
                </button>

                {/* Input de Fecha (Calendario nativo por día, mes y año) */}
                {waiterFilterMode === 'day' ? (
                  <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2 shadow-inner">
                    <Calendar className="w-5 h-5 text-amber-600" />
                    <input
                      type="date"
                      value={waiterDate}
                      onChange={(e) => {
                        if (e.target.value) setWaiterDate(e.target.value);
                      }}
                      className="bg-transparent text-gray-900 font-bold text-sm focus:outline-none cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-gray-500">{t('De')}:</span>
                      <input
                        type="date"
                        value={waiterStartDate}
                        onChange={(e) => setWaiterStartDate(e.target.value)}
                        className="bg-transparent text-gray-900 font-bold text-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-gray-500">{t('A')}:</span>
                      <input
                        type="date"
                        value={waiterEndDate}
                        onChange={(e) => setWaiterEndDate(e.target.value)}
                        className="bg-transparent text-gray-900 font-bold text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Botón día siguiente */}
                <button
                  onClick={() => shiftWaiterDate(1)}
                  disabled={isWaiterDateToday}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={t('Día siguiente')}
                >
                  <span className="hidden sm:inline">{t('Siguiente')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Atajos rápidos: Hoy / Ayer */}
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={setWaiterDateToToday}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      isWaiterDateToday
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('Hoy')}
                  </button>
                  <button
                    onClick={setWaiterDateToYesterday}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      isWaiterDateYesterday
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('Ayer')}
                  </button>
                </div>
              </div>

              {/* Selector de modo: Día único o Rango + Buscador */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t('Buscar camarero...')}
                    value={waiterSearchTerm}
                    onChange={(e) => setWaiterSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none w-40 sm:w-48"
                  />
                </div>

                <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold">
                  <button
                    onClick={() => setWaiterFilterMode('day')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      waiterFilterMode === 'day' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('Por Día')}
                  </button>
                  <button
                    onClick={() => setWaiterFilterMode('range')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      waiterFilterMode === 'range' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('Rango de Fechas')}
                  </button>
                </div>
              </div>
            </div>

            {/* Banner de Resumen del Día/Rango Seleccionado */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('Mostrando ventas de')}:
                </span>
                <span className="font-extrabold text-amber-900 text-sm bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 capitalize">
                  {getFormattedWaiterFilterLabel()}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">{t('Total Pedidos')}: </span>
                  <span className="font-bold text-gray-900">
                    {waiterReports.reduce((acc, r) => acc + r.totalOrders, 0)} ({waiterReports.reduce((acc, r) => acc + r.completedOrders, 0)} {t('cobrados')})
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="text-gray-500 text-xs">{t('Ventas Totales Camareros')}: </span>
                  <span className="font-extrabold text-amber-600 text-base">
                    {formatCurrency(waiterReports.reduce((acc, r) => acc + r.totalSales, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {loadingWaiters ? (
            <div className="p-12 text-center bg-white rounded-xl shadow-sm border">
              <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">{t('Cargando resumen de camareros...')}</p>
            </div>
          ) : waiterReports.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl shadow-sm border">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-bold">{t('No hay ventas registradas para los camareros')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {waiterReports
                .filter(r => !waiterSearchTerm || r.employeeName.toLowerCase().includes(waiterSearchTerm.toLowerCase()) || r.role.toLowerCase().includes(waiterSearchTerm.toLowerCase()))
                .map(report => {
                const isExpanded = expandedWaiterId === report.employeeId;
                return (
                  <div key={report.employeeId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md text-white font-bold text-xl">
                          {report.employeeName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-extrabold text-gray-900">{report.employeeName}</h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 capitalize">
                              {report.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {report.totalOrders} {t('pedidos realizados')} ({report.completedOrders} {t('cobrados')}, {report.pendingOrders} {t('pendientes')})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 font-semibold">{t('Total Recaudado')}</p>
                          <p className="text-2xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                            {formatCurrency(report.totalSales)}
                          </p>
                        </div>

                        <button
                          onClick={() => printWaiterReportTicket(report)}
                          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                          title={t('Imprimir ticket para ajustar cuentas con el camarero')}
                        >
                          <Printer className="w-4 h-4" />
                          <span>{t('Imprimir Ticket Camarero')}</span>
                        </button>

                        <button
                          onClick={() => setExpandedWaiterId(isExpanded ? null : report.employeeId)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title={t('Ver detalle de pedidos')}
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Lista desplegable de pedidos del camarero */}
                    {isExpanded && (
                      <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                          {t('Detalle de Pedidos de')} {report.employeeName}
                        </h4>
                        {report.orders.length === 0 ? (
                          <p className="text-sm text-gray-500">{t('Sin pedidos registrados')}</p>
                        ) : (
                          <div className="space-y-2">
                            {report.orders.map(ord => (
                              <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-gray-900 text-sm">
                                      #{ord.order_number ? String(ord.order_number).padStart(3, '0') : ord.id.slice(-6)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      • {new Date(ord.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {ord.tableName && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                        Mesa {ord.tableName}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {ord.itemsSummary || t('Artículos del pedido')}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                    ord.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {ord.status === 'completed' ? t('Cobrado') : t('Pendiente')}
                                  </span>
                                  <p className="font-bold text-gray-900 text-sm mt-0.5">
                                    {formatCurrency(ord.total)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal para registrar retiros de caja */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full m-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">{t('Registrar Retiro de Caja')}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Monto a retirar')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Motivo del retiro')} *
                  </label>
                  <select
                    value={withdrawalReason}
                    onChange={(e) => setWithdrawalReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('Seleccionar motivo')}</option>
                    <option value="Depósito bancario">{t('Depósito bancario')}</option>
                    <option value="Pago a proveedor">{t('Pago a proveedor')}</option>
                    <option value="Gastos operativos">{t('Gastos operativos')}</option>
                    <option value="Cambio de billetes">{t('Cambio de billetes')}</option>
                    <option value="Otros">{t('Otros')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Notas adicionales')} ({t('opcional')})
                  </label>
                  <textarea
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('Detalles adicionales sobre el retiro...')}
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>ℹ️ {t('Importante')}:</strong> {t('Este retiro se restará del cálculo del cierre de caja esperado.')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowWithdrawalModal(false);
                    setWithdrawalAmount('');
                    setWithdrawalReason('');
                    setWithdrawalNotes('');
                    setSelectedSessionForWithdrawal(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('Cancelar')}
                </button>
                <button
                  onClick={registerWithdrawal}
                  disabled={!withdrawalAmount || !withdrawalReason}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('Registrar Retiro')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
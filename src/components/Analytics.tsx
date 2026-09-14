import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { TrendingUp, DollarSign, ShoppingBag, Clock, Activity, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface DailySales {
  date: string;
  total: number;
  order_count: number;
}

interface TopProduct {
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

interface EmployeeActivity {
  id: string;
  full_name: string;
  role: string;
  last_login: string;
  total_sessions_today: number;
  total_orders_today: number;
  total_sales_today: number;
  is_online: boolean;
}

interface FinancialSummary {
  period: string;
  sales: number;
  expenses: number;
  profit: number;
  profit_margin: number;
}

interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
}

export function Analytics() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [employeeActivity, setEmployeeActivity] = useState<EmployeeActivity[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [occupiedTables, setOccupiedTables] = useState<number>(0);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetchStats();
    fetchDailySales();
    fetchTopProducts();
    fetchEmployeeActivity();
    fetchFinancialSummary();
    fetchRecentNotifications();
    fetchOccupiedTables();
    fetchCompanySettings();
    setupRealtimeSubscriptions();

    // Listen for company settings updates
    const handleCompanySettingsUpdate = (event: any) => {
      if (event.detail) {
        setCompanySettings(event.detail);
      }
    };

    window.addEventListener('companySettingsUpdated', handleCompanySettingsUpdate);

    return () => {
      window.removeEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
    };
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total')
      .gte('created_at', today)
      .eq('status', 'completed');

    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: customersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const todaySales = todayOrders?.reduce((sum, order) => sum + order.total, 0) || 0;

    setStats({
      todaySales,
      todayOrders: todayOrders?.length || 0,
      totalProducts: productsCount || 0,
      totalCustomers: customersCount || 0,
    });
  };

  const fetchEmployeeActivity = async () => {
    try {
      console.log('Fetching employee activity...');

      // Fetch only active employees who haven't been deleted (exclude super_admin)
      const { data: employees, error } = await supabase
        .from('employee_profiles')
        .select(`
          id,
          full_name,
          role,
          active,
          deleted_at,
          created_at,
          is_online,
          last_login
        `)
        .eq('active', true)
        .is('deleted_at', null)
        .neq('role', 'super_admin'); // Ocultar super_admin

      if (error) {
        console.error('Error fetching employees:', error);
        setEmployeeActivity([]);
        setOnlineUsers(0);
        return;
      }

      console.log(`Found ${employees?.length || 0} active employees`);

      if (employees && employees.length > 0) {
        const today = new Date().toISOString().split('T')[0];

        const activityData = await Promise.all(
          employees.map(async (emp) => {
            try {
              // Get sessions today
              const { data: sessions, error: sessionsError } = await supabase
                .from('cash_register_sessions')
                .select('id')
                .eq('employee_id', emp.id)
                .gte('opened_at', today);

              if (sessionsError) {
                console.error('Error fetching sessions for employee:', emp.id, sessionsError);
              }

              // Get orders today (all statuses to show real activity)
              const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('total, status')
                .eq('employee_id', emp.id)
                .gte('created_at', today);

              if (ordersError) {
                console.error('Error fetching orders for employee:', emp.id, ordersError);
              }

              // Calculate total sales from completed orders only
              const totalSales = orders
                ?.filter(order => order.status === 'completed')
                .reduce((sum, order) => sum + order.total, 0) || 0;

              // Usar el estado is_online directamente de la base de datos
              const isOnline = emp.is_online ?? false;
              const lastLogin = emp.last_login || emp.created_at;

              console.log(`Employee ${emp.full_name}: is_online: ${isOnline}, sessions today: ${sessions?.length || 0}, orders today: ${orders?.length || 0}`);

              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: lastLogin,
                total_sessions_today: sessions?.length || 0,
                total_orders_today: orders?.length || 0,
                total_sales_today: totalSales,
                is_online: isOnline ?? false,
              };
            } catch (empError) {
              console.error('Error processing employee:', emp.id, empError);
              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: emp.last_login || emp.created_at,
                total_sessions_today: 0,
                total_orders_today: 0,
                total_sales_today: 0,
                is_online: emp.is_online ?? false,
              };
            }
          })
        );

        const onlineCount = activityData.filter(emp => emp.is_online).length;
        console.log(`Total online users: ${onlineCount}`);
        console.log('Activity data:', activityData);

        setEmployeeActivity(activityData);
        setOnlineUsers(onlineCount);
      } else {
        console.log('No active employees found');
        setEmployeeActivity([]);
        setOnlineUsers(0);
      }
    } catch (error) {
      console.error('Error fetching employee activity:', error);
      setEmployeeActivity([]);
      setOnlineUsers(0);
    }
  };

  const fetchDailySales = async () => {
    try {
      // Get last 7 days manually since RPC might not exist
      const sales = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const { data: orders } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', dateStr)
          .lt('created_at', dateStr + 'T23:59:59')
          .eq('status', 'completed');

        const total = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
        const order_count = orders?.length || 0;

        sales.push({
          date: dateStr,
          total,
          order_count
        });
      }

      setDailySales(sales.filter(day => day.total > 0 || day.order_count > 0));
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      setDailySales([]);
    }
  };

  const fetchTopProducts = async () => {
    const { data } = await supabase
      .from('order_items')
      .select(`
        quantity,
        subtotal,
        products!inner(name)
      `);

    if (data) {
      const aggregated = data.reduce((acc: Record<string, TopProduct>, item) => {
        const name = (item.products as any)?.name || 'Unknown';
        if (!acc[name]) {
          acc[name] = { product_name: name, quantity_sold: 0, revenue: 0 };
        }
        acc[name].quantity_sold += item.quantity;
        acc[name].revenue += item.subtotal;
        return acc;
      }, {});

      const sorted = Object.values(aggregated)
        .sort((a, b) => b.quantity_sold - a.quantity_sold)
        .slice(0, 5);

      setTopProducts(sorted);
    }
  };


  const fetchFinancialSummary = async () => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const periods = [
      { name: t('Hoy'), start: new Date(today.toDateString()), end: new Date(today.toDateString() + ' 23:59:59') },
      { name: t('Esta Semana'), start: weekAgo, end: today },
      { name: t('Este Mes'), start: monthAgo, end: today },
    ];

    const summaries = await Promise.all(
      periods.map(async (period) => {
        // Get sales
        const { data: sales } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', period.start.toISOString())
          .lte('created_at', period.end.toISOString())
          .eq('status', 'completed');

        // Get expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .gte('created_at', period.start.toISOString())
          .lte('created_at', period.end.toISOString());

        const totalSales = sales?.reduce((sum, order) => sum + order.total, 0) || 0;
        const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
        const profit = totalSales - totalExpenses;
        const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

        return {
          period: period.name,
          sales: totalSales,
          expenses: totalExpenses,
          profit,
          profit_margin: profitMargin,
        };
      })
    );

    setFinancialSummary(summaries);
  };

  const fetchRecentNotifications = async () => {
    try {
      // Get recent cash register sessions (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // Get start of today for deleted orders
      const todayStart = new Date().toISOString().split('T')[0];

      const { data: sessions, error: sessionsError } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name, role)
        `)
        .neq('employee_profiles.role', 'super_admin') // Ocultar super_admin
        .gte('opened_at', yesterday.toISOString())
        .order('opened_at', { ascending: false })
        .limit(10);

      if (sessionsError) {
        console.error('Error fetching session notifications:', sessionsError);
      }

      // Get deleted orders from today
      const { data: deletedOrders, error: deletedOrdersError } = await supabase
        .from('deleted_orders')
        .select(`
          id,
          order_number,
          total,
          deletion_note,
          deleted_at,
          employee_profiles!deleted_orders_deleted_by_fkey(full_name, role)
        `)
        .neq('employee_profiles.role', 'super_admin') // Ocultar super_admin
        .gte('deleted_at', todayStart)
        .order('deleted_at', { ascending: false })
        .limit(20);

      if (deletedOrdersError) {
        console.error('Error fetching deleted order notifications:', deletedOrdersError);
      }

      // Get recent completed orders (last 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const { data: recentOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          created_at,
          employee_id
        `)
        .eq('status', 'completed')
        .gte('created_at', twoHoursAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(15);

      if (ordersError) {
        console.error('Error fetching recent orders:', ordersError);
      }

      // Obtener información de empleados para las órdenes
      let ordersWithEmployees: any[] = [];
      if (recentOrders && recentOrders.length > 0) {
        const employeeIds = [...new Set(recentOrders.map(o => o.employee_id))];
        const { data: employeesData } = await supabase
          .from('employee_profiles')
          .select('id, full_name, role')
          .in('id', employeeIds);

        ordersWithEmployees = recentOrders.map(order => ({
          ...order,
          employee_profiles: employeesData?.find(e => e.id === order.employee_id)
        })).filter(order =>
          // Filtrar órdenes de super_admin
          order.employee_profiles?.role !== 'super_admin'
        );
      }

      const sessionNotifications = (sessions || []).map(session => ({
        id: session.id,
        type: session.closed_at ? 'session_closed' : 'session_opened',
        message: session.closed_at
          ? `${(session.employee_profiles as any)?.full_name || 'Empleado'} ${t('cerró caja')}`
          : `${(session.employee_profiles as any)?.full_name || 'Empleado'} ${t('abrió caja')}`,
        timestamp: session.closed_at || session.opened_at,
        icon: session.closed_at ? '🔒' : '🔓',
      }));

      const deletedOrderNotifications = (deletedOrders || []).map(order => ({
        id: `deleted-${order.id}`,
        type: 'order_deleted',
        message: `${t('Pedido')} #${order.order_number?.toString().padStart(3, '0') || 'N/A'} ${t('eliminado por')} ${(order.employee_profiles as any)?.full_name || 'Admin'}`,
        note: order.deletion_note,
        total: order.total,
        timestamp: order.deleted_at,
        icon: '🗑️',
      }));

      const orderNotifications = (ordersWithEmployees || []).map(order => ({
        id: `order-${order.id}`,
        type: 'order_completed',
        message: `${t('Pedido')} #${order.order_number?.toString().padStart(3, '0') || 'N/A'} ${t('completado por')} ${order.employee_profiles?.full_name || 'Empleado'}`,
        total: order.total,
        timestamp: order.created_at,
        icon: '✅',
      }));

      // Combinar y ordenar todas las notificaciones por timestamp
      const allNotifications = [...sessionNotifications, ...deletedOrderNotifications, ...orderNotifications]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20); // Limitar a 20 notificaciones totales

      console.log('📢 Notificaciones cargadas:', allNotifications.length);
      setRecentNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setRecentNotifications([]);
    }
  };

  // ==========================================
  // HELPER FUNCTIONS & CORPORATE EXCEL ENGINE
  // ==========================================

  const getBusinessDateStr = (dateObj: Date = new Date()) => {
    const d = new Date(dateObj);
    if (d.getHours() < 4) {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getBusinessDayRange = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const start = new Date(year, month - 1, day, 4, 0, 0, 0);
    const end = new Date(year, month - 1, day + 1, 3, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  };

  const getBusinessWeekRange = (dateObj: Date = new Date()) => {
    const d = new Date(dateObj);
    if (d.getHours() < 4) {
      d.setDate(d.getDate() - 1);
    }
    const dayOfWeek = d.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - distanceToMonday);

    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 4, 0, 0, 0);
    const nextMonday = new Date(start);
    nextMonday.setDate(start.getDate() + 7);
    const end = new Date(nextMonday.getTime() - 1);

    return { startIso: start.toISOString(), endIso: end.toISOString() };
  };

  const getBusinessMonthRange = (dateObj: Date = new Date()) => {
    const d = new Date(dateObj);
    if (d.getHours() < 4) {
      d.setDate(d.getDate() - 1);
    }
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 4, 0, 0, 0);
    const nextMonthFirst = new Date(d.getFullYear(), d.getMonth() + 1, 1, 4, 0, 0, 0);
    const end = new Date(nextMonthFirst.getTime() - 1);

    return { startIso: start.toISOString(), endIso: end.toISOString() };
  };

  const autoFitColumns = (worksheet: XLSX.WorkSheet, data: any[][]) => {
    const colWidths = data.reduce((widths: number[], row: any[]) => {
      row.forEach((val, colIdx) => {
        const str = val !== null && val !== undefined ? String(val) : '';
        const len = Math.min(Math.max(str.length + 3, 11), 60);
        widths[colIdx] = Math.max(widths[colIdx] || 11, len);
      });
      return widths;
    }, []);
    worksheet['!cols'] = colWidths.map((w: number) => ({ wch: w }));
  };

  interface CorporateReportConfig {
    periodType: 'daily' | 'weekly' | 'monthly' | 'general';
    startIso: string;
    endIso: string;
    periodLabel: string;
    filename: string;
    toastId: string;
  }

  const generateCorporateExcelReport = async (config: CorporateReportConfig) => {
    try {
      toast.loading(t('reports.generating_excel') || 'Génération du rapport d\'entreprise...', { id: config.toastId });

      // 1. Consultation des données en parallèle
      const [
        ordersRes,
        expensesRes,
        sessionsRes,
        withdrawalsRes,
        employeesRes,
        tablesRes,
        historyRes,
        categoriesRes
      ] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            id,
            total,
            order_number,
            status,
            created_at,
            updated_at,
            payment_method,
            employee_id,
            table_id,
            service_type,
            order_items (
              id,
              quantity,
              unit_price,
              subtotal,
              products (id, name, category_id),
              product_sizes (id, size_name)
            )
          `)
          .gte('created_at', config.startIso)
          .lte('created_at', config.endIso)
          .eq('status', 'completed')
          .order('created_at', { ascending: true }),

        supabase
          .from('expenses')
          .select('*')
          .gte('created_at', config.startIso)
          .lte('created_at', config.endIso)
          .order('created_at', { ascending: true }),

        supabase
          .from('cash_register_sessions')
          .select('*')
          .gte('opened_at', config.startIso)
          .lte('opened_at', config.endIso)
          .order('opened_at', { ascending: true }),

        supabase
          .from('cash_withdrawals')
          .select('*')
          .gte('withdrawn_at', config.startIso)
          .lte('withdrawn_at', config.endIso)
          .order('withdrawn_at', { ascending: true }),

        supabase.from('employee_profiles').select('id, full_name, role'),
        supabase.from('tables').select('id, name'),
        supabase.from('order_history').select('order_id, employee_id, created_at, action').eq('action', 'completed'),
        supabase.from('categories').select('id, name')
      ]);

      const orders = ordersRes.data || [];
      const expenses = expensesRes.data || [];
      const sessions = sessionsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];

      // 2. Indexation rapide par Map
      const empMap = new Map<string, { full_name: string; role: string }>();
      (employeesRes.data || []).forEach(e => empMap.set(e.id, { full_name: e.full_name, role: e.role }));

      const tableMap = new Map<string, string>();
      (tablesRes.data || []).forEach(t => tableMap.set(t.id, t.name));

      const categoryMap = new Map<string, string>();
      (categoriesRes.data || []).forEach(c => categoryMap.set(c.id, c.name));

      const completedHistoryMap = new Map<string, { employee_id: string; created_at: string }>();
      (historyRes.data || []).forEach(h => {
        if (!completedHistoryMap.has(h.order_id)) {
          completedHistoryMap.set(h.order_id, h);
        }
      });

      // 3. Calculs financiers globaux
      const totalSales = orders.reduce((sum, o) => sum + (typeof o.total === 'string' ? parseFloat(o.total) : (o.total || 0)), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount || 0)), 0);
      const netProfit = totalSales - totalExpenses;
      const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
      const orderCount = orders.length;
      const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;

      // Modes de paiement
      let payCashCount = 0, payCashTotal = 0;
      let payCardCount = 0, payCardTotal = 0;
      let payDigitalCount = 0, payDigitalTotal = 0;

      orders.forEach(o => {
        const amt = typeof o.total === 'string' ? parseFloat(o.total) : (o.total || 0);
        if (o.payment_method === 'card') {
          payCardCount++;
          payCardTotal += amt;
        } else if (o.payment_method === 'digital') {
          payDigitalCount++;
          payDigitalTotal += amt;
        } else {
          payCashCount++;
          payCashTotal += amt;
        }
      });

      const payCashPct = totalSales > 0 ? (payCashTotal / totalSales) * 100 : 0;
      const payCardPct = totalSales > 0 ? (payCardTotal / totalSales) * 100 : 0;
      const payDigitalPct = totalSales > 0 ? (payDigitalTotal / totalSales) * 100 : 0;

      // Types de service
      let dineInCount = 0, dineInTotal = 0;
      let takeawayCount = 0, takeawayTotal = 0;

      orders.forEach(o => {
        const amt = typeof o.total === 'string' ? parseFloat(o.total) : (o.total || 0);
        if (o.service_type === 'takeaway') {
          takeawayCount++;
          takeawayTotal += amt;
        } else {
          dineInCount++;
          dineInTotal += amt;
        }
      });

      const dineInPct = totalSales > 0 ? (dineInTotal / totalSales) * 100 : 0;
      const takeawayPct = totalSales > 0 ? (takeawayTotal / totalSales) * 100 : 0;

      const totalUnitsSold = orders.reduce((sum, o) => {
        return sum + (o.order_items || []).reduce((iSum: number, item: any) => iSum + (item.quantity || 0), 0);
      }, 0);

      // 4. Mix de Produits et Pareto ABC (80/20)
      const productMap = new Map<string, {
        name: string;
        categoryName: string;
        quantity: number;
        revenue: number;
      }>();

      orders.forEach(o => {
        (o.order_items || []).forEach((it: any) => {
          const pObj = Array.isArray(it.products) ? it.products[0] : it.products;
          const pName = pObj?.name || 'Produit inconnu';
          const catName = pObj?.category_id ? (categoryMap.get(pObj.category_id) || 'Divers') : 'Divers';
          const sObj = Array.isArray(it.product_sizes) ? it.product_sizes[0] : it.product_sizes;
          const fullName = sObj?.size_name ? `${pName} (${sObj.size_name})` : pName;
          const q = it.quantity || 0;
          const rev = it.subtotal ? (typeof it.subtotal === 'string' ? parseFloat(it.subtotal) : it.subtotal) : (q * (it.unit_price || 0));

          if (!productMap.has(fullName)) {
            productMap.set(fullName, { name: fullName, categoryName: catName, quantity: 0, revenue: 0 });
          }
          const rec = productMap.get(fullName)!;
          rec.quantity += q;
          rec.revenue += rev;
        });
      });

      const productMixSorted = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
      let cumulativeRevenue = 0;
      const productMixFinal = productMixSorted.map((p, idx) => {
        cumulativeRevenue += p.revenue;
        const sharePct = totalSales > 0 ? (p.revenue / totalSales) * 100 : 0;
        const cumPct = totalSales > 0 ? (cumulativeRevenue / totalSales) * 100 : 0;
        const avgPrice = p.quantity > 0 ? p.revenue / p.quantity : 0;
        let paretoClass = 'Classe A (Produit Star)';
        if (cumPct > 95) {
          paretoClass = 'Classe C (Faible rotation)';
        } else if (cumPct > 80) {
          paretoClass = 'Classe B (Intermédiaire)';
        }
        return [
          idx + 1,
          p.categoryName,
          p.name,
          p.quantity,
          Number(avgPrice.toFixed(2)),
          Number(p.revenue.toFixed(2)),
          `${sharePct.toFixed(2)}%`,
          `${cumPct.toFixed(2)}%`,
          paretoClass
        ];
      });

      // 5. Rendement du Personnel / Serveurs
      const staffMap = new Map<string, {
        name: string;
        role: string;
        orderCount: number;
        totalSales: number;
        waitMinutesSum: number;
      }>();

      orders.forEach(o => {
        const empId = o.employee_id || 'system';
        const empProfile = empMap.get(empId);
        const name = (!empProfile || empProfile.role === 'super_admin') ? 'Système (Super Admin)' : empProfile.full_name;
        const role = empProfile?.role || 'Service';
        const amt = typeof o.total === 'string' ? parseFloat(o.total) : (o.total || 0);

        const created = new Date(o.created_at).getTime();
        const hist = completedHistoryMap.get(o.id);
        const paid = hist?.created_at ? new Date(hist.created_at).getTime() : (o.updated_at ? new Date(o.updated_at).getTime() : created);
        const waitMin = Math.max(0, Math.round((paid - created) / 60000));

        if (!staffMap.has(name)) {
          staffMap.set(name, { name, role, orderCount: 0, totalSales: 0, waitMinutesSum: 0 });
        }
        const sRec = staffMap.get(name)!;
        sRec.orderCount++;
        sRec.totalSales += amt;
        sRec.waitMinutesSum += waitMin;
      });

      const staffRows = Array.from(staffMap.values())
        .sort((a, b) => b.totalSales - a.totalSales)
        .map(s => {
          const sharePct = totalSales > 0 ? (s.totalSales / totalSales) * 100 : 0;
          const avgT = s.orderCount > 0 ? s.totalSales / s.orderCount : 0;
          const avgW = s.orderCount > 0 ? Math.round(s.waitMinutesSum / s.orderCount) : 0;
          return [
            s.name,
            s.role,
            s.orderCount,
            Number(s.totalSales.toFixed(2)),
            Number(avgT.toFixed(2)),
            avgW,
            `${sharePct.toFixed(2)}%`
          ];
        });

      // 6. Analyse Temporelle (Horaire ou Journalière)
      let temporalHeader: string[] = [];
      let temporalDataRows: any[][] = [];

      if (config.periodType === 'daily') {
        temporalHeader = ['Tranche Horaire', 'Commandes Encaissées', 'Chiffre d\'Affaires (DH)', 'Part du Jour (%)', 'Ticket Moyen (DH)', 'Affluence Estimée'];
        const hourlyMap = new Array(24).fill(0).map((_, h) => ({
          hourLabel: `${String(h).padStart(2, '0')}:00 - ${String(h).padStart(2, '0')}:59`,
          orderCount: 0,
          totalSales: 0
        }));

        orders.forEach(o => {
          const h = new Date(o.created_at).getHours();
          const amt = typeof o.total === 'string' ? parseFloat(o.total) : (o.total || 0);
          if (hourlyMap[h]) {
            hourlyMap[h].orderCount++;
            hourlyMap[h].totalSales += amt;
          }
        });

        temporalDataRows = hourlyMap.map(hm => {
          const share = totalSales > 0 ? (hm.totalSales / totalSales) * 100 : 0;
          const avg = hm.orderCount > 0 ? hm.totalSales / hm.orderCount : 0;
          let affluence = 'Calme';
          if (share > 15) affluence = 'Très Élevée (Coup de feu)';
          else if (share > 8) affluence = 'Moyenne (Active)';
          return [
            hm.hourLabel,
            hm.orderCount,
            Number(hm.totalSales.toFixed(2)),
            `${share.toFixed(1)}%`,
            Number(avg.toFixed(2)),
            affluence
          ];
        });
      } else {
        temporalHeader = ['Date', 'Jour de la Semaine', 'Commandes Encaissées', 'Chiffre d\'Affaires (DH)', 'Dépenses (DH)', 'Bénéfice (DH)', 'Ticket Moyen (DH)'];
        const dailyMap = new Map<string, { dateStr: string; weekday: string; orderCount: number; totalSales: number; expenses: number }>();

        orders.forEach(o => {
          const dObj = new Date(o.created_at);
          const dateStr = dObj.toLocaleDateString('fr-FR');
          const weekday = dObj.toLocaleDateString('fr-FR', { weekday: 'long' });
          const amt = typeof o.total === 'string' ? parseFloat(o.total) : (o.total || 0);
          if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, { dateStr, weekday, orderCount: 0, totalSales: 0, expenses: 0 });
          }
          const rec = dailyMap.get(dateStr)!;
          rec.orderCount++;
          rec.totalSales += amt;
        });

        expenses.forEach(e => {
          const dObj = new Date(e.created_at);
          const dateStr = dObj.toLocaleDateString('fr-FR');
          const weekday = dObj.toLocaleDateString('fr-FR', { weekday: 'long' });
          const amt = typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount || 0);
          if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, { dateStr, weekday, orderCount: 0, totalSales: 0, expenses: 0 });
          }
          const rec = dailyMap.get(dateStr)!;
          rec.expenses += amt;
        });

        temporalDataRows = Array.from(dailyMap.values()).map(dm => {
          const prof = dm.totalSales - dm.expenses;
          const avg = dm.orderCount > 0 ? dm.totalSales / dm.orderCount : 0;
          return [
            dm.dateStr,
            dm.weekday.toUpperCase(),
            dm.orderCount,
            Number(dm.totalSales.toFixed(2)),
            Number(dm.expenses.toFixed(2)),
            Number(prof.toFixed(2)),
            Number(avg.toFixed(2))
          ];
        });
      }

      // 7. Dépenses d'exploitation par catégorie
      const catExpensesMap = new Map<string, { count: number; total: number }>();
      expenses.forEach(e => {
        const cat = e.category || 'Non Catégorisé';
        const amt = typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount || 0);
        if (!catExpensesMap.has(cat)) {
          catExpensesMap.set(cat, { count: 0, total: 0 });
        }
        const rec = catExpensesMap.get(cat)!;
        rec.count++;
        rec.total += amt;
      });

      const catExpensesRows = Array.from(catExpensesMap.entries()).map(([cat, val]) => {
        const pct = totalExpenses > 0 ? (val.total / totalExpenses) * 100 : 0;
        return [cat, val.count, Number(val.total.toFixed(2)), `${pct.toFixed(1)}%`];
      });

      const totalWithdrawalsSum = withdrawals.reduce((sum, w) => sum + (typeof w.amount === 'string' ? parseFloat(w.amount) : (w.amount || 0)), 0);

      // ==========================================
      // CRÉATION DU CLASSEUR EXCEL MULTI-FEUILLES
      // ==========================================
      const wb = XLSX.utils.book_new();

      // --- FEUILLE 1 : TABLEAU DE BORD & KPIS ---
      const summaryRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['LIN-CAISSE - RAPPORT DE GESTION & AUDIT FINANCIER D\'ENTREPRISE'],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        ['INFORMATIONS GÉNÉRALES DE L\'ÉTABLISSEMENT', ''],
        ['Établissement / Société:', companySettings?.company_name || 'LIN-Caisse Restaurant & Café'],
        ['Adresse:', companySettings?.address || 'Non spécifiée'],
        ['Téléphone:', companySettings?.phone || 'Non spécifié'],
        ['Type de Rapport:', config.periodLabel],
        ['Période Analysée:', `${new Date(config.startIso).toLocaleString('fr-FR')} au ${new Date(config.endIso).toLocaleString('fr-FR')}`],
        ['Date d\'Émission:', new Date().toLocaleDateString('fr-FR')],
        ['Heure d\'Émission:', new Date().toLocaleTimeString('fr-FR')],
        ['Émis par:', profile?.full_name || 'Système'],
        [''],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['INDICATEURS CLÉS DE PERFORMANCE (KPIS FINANCIERS)'],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['Indicateur Financier', 'Montant / Valeur', 'Unité'],
        ['Chiffre d\'Affaires Brut (Ventes Totales)', Number(totalSales.toFixed(2)), 'DH'],
        ['Total Commandes Encaissées', orderCount, 'Commandes'],
        ['Panier Moyen / Ticket Moyen', Number(avgTicket.toFixed(2)), 'DH / Commande'],
        ['Total Charges & Dépenses d\'Exploitation', Number(totalExpenses.toFixed(2)), 'DH'],
        ['Bénéfice Net d\'Exploitation', Number(netProfit.toFixed(2)), 'DH'],
        ['Marge Bénéficiaire Nette', `${profitMargin.toFixed(2)}%`, 'Taux de Rentabilité'],
        ['Total Articles / Produits Vendus', totalUnitsSold, 'Unités'],
        ['Nombre de Sessions de Caisse', sessions.length, 'Sessions'],
        [''],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['RÉPARTITION PAR MODE D\'ENCAISSEMENT (PAIEMENTS)'],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['Mode de Paiement', 'Nombre de Commandes', 'Total Encaissé (DH)', 'Part de Marché (%)'],
        ['Espèces (Cash)', payCashCount, Number(payCashTotal.toFixed(2)), `${payCashPct.toFixed(1)}%`],
        ['Carte Bancaire (TPE)', payCardCount, Number(payCardTotal.toFixed(2)), `${payCardPct.toFixed(1)}%`],
        ['Paiement Digital / Virement', payDigitalCount, Number(payDigitalTotal.toFixed(2)), `${payDigitalPct.toFixed(1)}%`],
        ['TOTAL TOUS MODES', orderCount, Number(totalSales.toFixed(2)), '100.0%'],
        [''],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['RÉPARTITION PAR TYPE DE SERVICE'],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['Type de Service', 'Nombre de Commandes', 'Total Ventes (DH)', 'Part (%)'],
        ['En Salle (Dine-in)', dineInCount, Number(dineInTotal.toFixed(2)), `${dineInPct.toFixed(1)}%`],
        ['À Emporter (Takeaway)', takeawayCount, Number(takeawayTotal.toFixed(2)), `${takeawayPct.toFixed(1)}%`],
        ['TOTAL SERVICE', orderCount, Number(totalSales.toFixed(2)), '100.0%']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      autoFitColumns(wsSummary, summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tableau de Bord & KPIs');

      // --- FEUILLE 2 : MIX PRODUITS & PARETO ---
      const productRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['ANALYSE DE VENTES PAR PRODUIT & CLASSIFICATION PARETO (80/20)'],
        ['Période:', `${new Date(config.startIso).toLocaleDateString('fr-FR')} au ${new Date(config.endIso).toLocaleDateString('fr-FR')}`],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        ['Rang', 'Catégorie', 'Désignation du Produit', 'Quantité Vendue', 'Prix Moyen (DH)', 'Chiffre d\'Affaires (DH)', 'Part des Ventes (%)', 'Part Cumulée (%)', 'Classification Pareto'],
        ...productMixFinal,
        [''],
        ['TOTAL DES VENTES PRODUITS:', '', '', totalUnitsSold, '', Number(totalSales.toFixed(2)), '100.0%', '100.0%', '']
      ];

      const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
      autoFitColumns(wsProducts, productRows);
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Mix Produits (Pareto)');

      // --- FEUILLE 3 : RENDEMENT DU PERSONNEL ---
      const overallAvgWait = staffRows.length > 0
        ? Math.round(staffRows.reduce((acc, r) => acc + (Number(r[5]) || 0), 0) / staffRows.length)
        : 0;

      const staffSheetRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['PERFORMANCE ET ANALYSE D\'ACTIVITÉ DU PERSONNEL'],
        ['Période:', `${new Date(config.startIso).toLocaleDateString('fr-FR')} au ${new Date(config.endIso).toLocaleDateString('fr-FR')}`],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        ['Employé / Serveur', 'Rôle', 'Commandes Traitées', 'Ventes Totales (DH)', 'Ticket Moyen (DH)', 'Temps Moyen de Service (min)', 'Contribution aux Ventes (%)'],
        ...staffRows,
        [''],
        ['TOTAL ÉQUIPE:', '', orderCount, Number(totalSales.toFixed(2)), Number(avgTicket.toFixed(2)), overallAvgWait, '100.0%']
      ];

      const wsStaff = XLSX.utils.aoa_to_sheet(staffSheetRows);
      autoFitColumns(wsStaff, staffSheetRows);
      XLSX.utils.book_append_sheet(wb, wsStaff, 'Rendement Personnel');

      // --- FEUILLE 4 : DÉTAIL DES COMMANDES (AUDIT LIGNE À LIGNE) ---
      const ordersAuditRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['AUDIT COMPLET DES COMMANDES ENCAISSÉES (TRANSACTIONS LIGNE PAR LIGNE)'],
        ['Période:', `${new Date(config.startIso).toLocaleDateString('fr-FR')} au ${new Date(config.endIso).toLocaleDateString('fr-FR')}`],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        ['N° Commande', 'Date', 'Heure Prise', 'Heure Paiement', 'Durée Service (min)', 'Lieu / Table', 'Serveur (Prise)', 'Caissier (Encaissement)', 'Articles Consommés', 'Mode de Paiement', 'Montant Total (DH)'],
        ...orders.map(order => {
          const orderNumStr = order.order_number ? `#${String(order.order_number).padStart(3, '0')}` : `#${order.id.slice(-6)}`;
          const tableStr = order.table_id ? `Mesa ${tableMap.get(order.table_id) || ''}` : (order.service_type === 'takeaway' ? 'À emporter' : 'Comptoir');

          const creatorEmp = order.employee_id ? empMap.get(order.employee_id) : null;
          const creatorName = creatorEmp?.role === 'super_admin' ? 'Système' : (creatorEmp?.full_name || 'Serveur');
          const createdTime = new Date(order.created_at);
          const createdTimeStr = createdTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const orderDateStr = createdTime.toLocaleDateString('fr-FR');

          const historyEntry = completedHistoryMap.get(order.id);
          const cashierEmpId = historyEntry?.employee_id;
          const cashierEmp = cashierEmpId ? empMap.get(cashierEmpId) : null;
          const cashierName = cashierEmp?.role === 'super_admin' ? 'Système' : (cashierEmp?.full_name || 'Caisse');
          const paidTime = historyEntry?.created_at ? new Date(historyEntry.created_at) : (order.updated_at ? new Date(order.updated_at) : createdTime);
          const paidTimeStr = paidTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          const diffMs = paidTime.getTime() - createdTime.getTime();
          const serviceMinutes = Math.max(0, Math.round(diffMs / 60000));

          const itemsStr = (order.order_items || []).map((item: any) => {
            const pName = Array.isArray(item.products) ? item.products[0]?.name : item.products?.name;
            const sName = Array.isArray(item.product_sizes) ? item.product_sizes[0]?.size_name : item.product_sizes?.size_name;
            return `${item.quantity}x ${pName || 'Produit'}${sName ? ` (${sName})` : ''}`;
          }).join(', ');

          const payMethodStr = order.payment_method === 'cash' ? 'Espèces' : order.payment_method === 'card' ? 'Carte' : order.payment_method === 'digital' ? 'Digital' : 'Espèces';

          return [
            orderNumStr,
            orderDateStr,
            createdTimeStr,
            paidTimeStr,
            serviceMinutes,
            tableStr,
            creatorName,
            cashierName,
            itemsStr || 'Sans détail',
            payMethodStr,
            Number((typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0)).toFixed(2))
          ];
        }),
        [''],
        ['TOTAL DES VENTES:', '', '', '', '', '', '', '', '', '', Number(totalSales.toFixed(2))]
      ];

      const wsOrders = XLSX.utils.aoa_to_sheet(ordersAuditRows);
      autoFitColumns(wsOrders, ordersAuditRows);
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Détail des Commandes');

      // --- FEUILLE 5 : CONTRÔLE DE CAISSE & ARQUEOS ---
      const cashRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['HISTORIQUE DES SESSIONS DE CAISSE ET CONTRÔLE D\'ARQUEO'],
        ['Période:', `${new Date(config.startIso).toLocaleDateString('fr-FR')} au ${new Date(config.endIso).toLocaleDateString('fr-FR')}`],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        ['Session #', 'Date', 'Caissier', 'Heure Ouverture', 'Heure Fermeture', 'Fond Initial (DH)', 'Fond Final Réel (DH)', 'Statut de Session'],
        ...sessions.map((session, idx) => {
          const emp = empMap.get(session.employee_id);
          const cName = emp?.role === 'super_admin' ? 'Système' : (emp?.full_name || 'Caissier');
          const dStr = new Date(session.opened_at).toLocaleDateString('fr-FR');
          const oTime = new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const cTime = session.closed_at ? new Date(session.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'En cours';
          return [
            `Session #${idx + 1}`,
            dStr,
            cName,
            oTime,
            cTime,
            session.opening_amount || 0,
            session.closing_amount !== null && session.closing_amount !== undefined ? session.closing_amount : 'En cours (Ouverte)',
            session.status === 'open' ? 'Ouverte' : 'Clôturée'
          ];
        }),
        [''],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['REGISTRE DES RETRAITS DE CAISSE'],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['Date & Heure', 'Effectué par', 'Motif / Raison du Retrait', 'Montant (DH)', 'Notes complémentaires'],
        ...withdrawals.map(w => [
          new Date(w.withdrawn_at).toLocaleString('fr-FR'),
          empMap.get(w.withdrawn_by)?.full_name || 'Personnel',
          w.reason || 'Dépense / Retrait',
          Number((typeof w.amount === 'string' ? parseFloat(w.amount) : (w.amount || 0)).toFixed(2)),
          w.notes || '-'
        ]),
        ['TOTAL RETRAITS:', '', '', Number(totalWithdrawalsSum.toFixed(2)), '']
      ];

      const wsCash = XLSX.utils.aoa_to_sheet(cashRows);
      autoFitColumns(wsCash, cashRows);
      XLSX.utils.book_append_sheet(wb, wsCash, 'Contrôle de Caisse');

      // --- FEUILLE 6 : ANALYSE TEMPORELLE & HEURES DE POINTE ---
      const temporalSheetRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [config.periodType === 'daily' ? 'ANALYSE DE L\'AFFLUENCE PAR TRANCHE HORAIRE' : 'ÉVOLUTION QUOTIDIENNE DES VENTES DU CYCLE'],
        ['Période:', `${new Date(config.startIso).toLocaleDateString('fr-FR')} au ${new Date(config.endIso).toLocaleDateString('fr-FR')}`],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        temporalHeader,
        ...temporalDataRows,
        [''],
        ['TOTAL:', orderCount, Number(totalSales.toFixed(2)), '100.0%', Number(avgTicket.toFixed(2)), '']
      ];

      const wsTemporal = XLSX.utils.aoa_to_sheet(temporalSheetRows);
      autoFitColumns(wsTemporal, temporalSheetRows);
      XLSX.utils.book_append_sheet(wb, wsTemporal, 'Analyse Temporelle');

      // --- FEUILLE 7 : DÉPENSES D'EXPLOITATION ---
      const expensesSheetRows: any[][] = [
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        ['REGISTRE DÉTAILLÉ DES DÉPENSES D\'EXPLOITATION'],
        ['Période:', `${new Date(config.startIso).toLocaleDateString('fr-FR')} au ${new Date(config.endIso).toLocaleDateString('fr-FR')}`],
        ['═══════════════════════════════════════════════════════════════════════════════════'],
        [''],
        ['RÉSUMÉ PAR CATÉGORIE DE DÉPENSES'],
        ['Catégorie', 'Nombre de Dépenses', 'Montant Total (DH)', 'Part des Dépenses (%)'],
        ...catExpensesRows,
        ['TOTAL DES CHARGES:', expenses.length, Number(totalExpenses.toFixed(2)), '100.0%'],
        [''],
        ['DÉTAIL CHRONOLOGIQUE DES DÉPENSES'],
        ['Date', 'Heure', 'Catégorie', 'Description / Motif', 'Montant (DH)'],
        ...expenses.map(e => [
          new Date(e.created_at).toLocaleDateString('fr-FR'),
          new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          e.category || 'Général',
          e.description || '-',
          Number((typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount || 0)).toFixed(2))
        ]),
        ['TOTAL DÉPENSES:', '', '', '', Number(totalExpenses.toFixed(2))]
      ];

      const wsExpenses = XLSX.utils.aoa_to_sheet(expensesSheetRows);
      autoFitColumns(wsExpenses, expensesSheetRows);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Dépenses d\'Exploitation');

      // 8. Sauvegarde du fichier
      XLSX.writeFile(wb, config.filename);
      toast.success(t('reports.excel_generated_success') || 'Rapport Excel généré avec succès !', { id: config.toastId });
    } catch (error) {
      console.error('Erreur lors de la génération du rapport d\'entreprise:', error);
      toast.error(t('reports.error_generating_excel') || 'Erreur lors de la génération du rapport Excel', { id: config.toastId });
    }
  };

  const generateDailyReport = async (_summary?: FinancialSummary) => {
    const todayBusiness = getBusinessDateStr();
    const { startIso, endIso } = getBusinessDayRange(todayBusiness);
    await generateCorporateExcelReport({
      periodType: 'daily',
      startIso,
      endIso,
      periodLabel: `Journalier (${todayBusiness})`,
      filename: `Rapport_Journalier_LIN-Caisse_${todayBusiness}.xlsx`,
      toastId: 'daily-report'
    });
  };

  const generateWeeklyReport = async (_summary?: FinancialSummary) => {
    const { startIso, endIso } = getBusinessWeekRange();
    const weekStartStr = new Date(startIso).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const weekEndStr = new Date(endIso).toLocaleDateString('fr-FR').replace(/\//g, '-');
    await generateCorporateExcelReport({
      periodType: 'weekly',
      startIso,
      endIso,
      periodLabel: `Hebdomadaire (${weekStartStr} au ${weekEndStr})`,
      filename: `Rapport_Hebdomadaire_LIN-Caisse_${weekStartStr}_au_${weekEndStr}.xlsx`,
      toastId: 'weekly-report'
    });
  };

  const generateMonthlyReport = async (_summary?: FinancialSummary) => {
    const { startIso, endIso } = getBusinessMonthRange();
    const monthYearStr = new Date(startIso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const year = new Date(startIso).getFullYear();
    const month = String(new Date(startIso).getMonth() + 1).padStart(2, '0');
    await generateCorporateExcelReport({
      periodType: 'monthly',
      startIso,
      endIso,
      periodLabel: `Mensuel (${monthYearStr})`,
      filename: `Rapport_Mensuel_LIN-Caisse_${year}_${month}.xlsx`,
      toastId: 'monthly-report'
    });
  };

  const exportToExcel = async () => {
    const todayBusiness = getBusinessDateStr();
    const { endIso } = getBusinessDayRange(todayBusiness);
    // Export global complet
    const startIso = new Date('2020-01-01T00:00:00.000Z').toISOString();
    await generateCorporateExcelReport({
      periodType: 'general',
      startIso,
      endIso,
      periodLabel: 'Audit Global Complet',
      filename: `Rapport_Global_Complet_LIN-Caisse_${todayBusiness}.xlsx`,
      toastId: 'export'
    });
  };

  const fetchOccupiedTables = async () => {
    try {
      const { data: tables, error } = await supabase
        .from('tables')
        .select('id, status')
        .eq('status', 'occupied');

      if (error) throw error;
      setOccupiedTables(tables?.length || 0);
    } catch (error) {
      console.error('Error fetching occupied tables:', error);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to employee status changes (online/offline)
    const employeeSubscription = supabase
      .channel('employee_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'employee_profiles'
      }, (payload) => {
        console.log('🔔 Employee status changed:', payload);
        const updatedEmployee = payload.new as any;
        const oldEmployee = payload.old as any;

        // Refrescar la actividad de empleados
        fetchEmployeeActivity();

        // Si es admin/super_admin y el estado de conexión cambió, mostrar notificación
        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
          // Verificar que no sea el super_admin y que el estado cambió
          if (updatedEmployee.role !== 'super_admin' &&
              updatedEmployee.is_online !== undefined &&
              oldEmployee.is_online !== undefined &&
              updatedEmployee.is_online !== oldEmployee.is_online) {
            const statusText = updatedEmployee.is_online ? t('connected') : t('disconnected');
            toast(`${updatedEmployee.full_name} ${statusText}`, {
              icon: updatedEmployee.is_online ? '🟢' : '🔴',
              duration: 3000,
            });
          }
        }
      })
      .subscribe((status) => {
        console.log('📡 Employee status subscription:', status);
      });

    // Subscribe to cash register sessions
    const sessionSubscription = supabase
      .channel('cash_sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_register_sessions'
      }, (payload) => {
        console.log('Cash session change:', payload);
        fetchEmployeeActivity();
        fetchRecentNotifications();

        // Show toast notification
        if (payload.eventType === 'INSERT') {
          toast.success('Nueva sesión de caja abierta', { icon: '🔓' });
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'closed') {
          toast.success('Sesión de caja cerrada', { icon: '🔒' });
        }
      })
      .subscribe();

    // Subscribe to orders
    const orderSubscription = supabase
      .channel('orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchStats();
        fetchEmployeeActivity();
      })
      .subscribe();

    // Subscribe to tables
    const tableSubscription = supabase
      .channel('tables')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables'
      }, () => {
        fetchOccupiedTables();
      })
      .subscribe();

    return () => {
      employeeSubscription.unsubscribe();
      sessionSubscription.unsubscribe();
      orderSubscription.unsubscribe();
      tableSubscription.unsubscribe();
    };
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{t('Analíticas y Reportes')}</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-xs text-xs sm:text-sm">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
            <span className="font-bold text-green-700">{onlineUsers} {t('conectados')}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl shadow-xs text-xs sm:text-sm">
            <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-sm"></div>
            <span className="font-bold text-yellow-700">{occupiedTables} {t('mesas')}</span>
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all duration-200 font-bold shadow-md text-xs sm:text-sm active:scale-95 ml-auto sm:ml-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('Exportar Excel')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
        <div className="bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 rounded-2xl shadow-2xl p-6 text-white transform hover:scale-105 hover:shadow-3xl transition-all duration-300 border-2 border-green-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <DollarSign className="w-7 h-7" />
            </div>
            <span className="text-sm font-black opacity-95 bg-white/20 px-3 py-1 rounded-lg">{t('Hoy')}</span>
          </div>
          <p className="text-3xl font-black mb-2">{formatCurrency(stats.todaySales)}</p>
          <p className="text-sm font-semibold opacity-90">{t('Ventas del día')}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 rounded-2xl shadow-2xl p-6 text-white transform hover:scale-105 hover:shadow-3xl transition-all duration-300 border-2 border-blue-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <span className="text-sm font-black opacity-95 bg-white/20 px-3 py-1 rounded-lg">{t('Hoy')}</span>
          </div>
          <p className="text-3xl font-black mb-2">{stats.todayOrders}</p>
          <p className="text-sm font-semibold opacity-90">{t('Órdenes completadas')}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-2xl shadow-2xl p-6 text-white transform hover:scale-105 hover:shadow-3xl transition-all duration-300 border-2 border-amber-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7" />
            </div>
            <span className="text-sm font-black opacity-95 bg-white/20 px-3 py-1 rounded-lg">{t('Total')}</span>
          </div>
          <p className="text-3xl font-black mb-2">{stats.totalProducts}</p>
          <p className="text-sm font-semibold opacity-90">{t('Productos activos')}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 via-pink-500 to-red-600 rounded-2xl shadow-2xl p-6 text-white transform hover:scale-105 hover:shadow-3xl transition-all duration-300 border-2 border-red-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Activity className="w-7 h-7" />
            </div>
            <span className="text-sm font-black opacity-95 bg-white/20 px-3 py-1 rounded-lg">{t('Activos')}</span>
          </div>
          <p className="text-3xl font-black mb-2">{onlineUsers}</p>
          <p className="text-sm font-semibold opacity-90">{t('Usuarios conectados')}</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white transform hover:scale-105 hover:shadow-3xl transition-all duration-300 border-2 border-indigo-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <span className="text-sm font-black opacity-95 bg-white/20 px-3 py-1 rounded-lg">{t('Ahora')}</span>
          </div>
          <p className="text-3xl font-black mb-2">{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm font-semibold opacity-90">{t('Hora actual')}</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {financialSummary.map((summary, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-gray-100 hover:border-purple-300 transition-all duration-300 transform hover:-translate-y-1">
            <h3 className="text-2xl font-black text-gray-900 mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{summary.period}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Ventas:')}</span>
                <span className="font-semibold text-green-600">{formatCurrency(summary.sales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Gastos:')}</span>
                <span className="font-semibold text-red-600">{formatCurrency(summary.expenses)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium text-gray-900">{t('Beneficio:')}</span>
                <span className={`font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.profit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Margen:')}</span>
                <span className={`font-semibold ${summary.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profit_margin.toFixed(1)}%
                </span>
              </div>
              <div className="mt-4 pt-4 border-t">
                {summary.period === t('Hoy') && (
                  <button
                    onClick={() => generateDailyReport(summary)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t('Generar Reporte Diario')}
                  </button>
                )}
                {summary.period === t('Esta Semana') && (
                  <button
                    onClick={() => generateWeeklyReport(summary)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t('Generar Reporte Semanal')}
                  </button>
                )}
                {summary.period === t('Este Mes') && (
                  <button
                    onClick={() => generateMonthlyReport(summary)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t('Generar Reporte Mensual')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Actividad de Empleados')}</h3>
          {employeeActivity.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {employeeActivity.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${emp.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{emp.full_name}</p>
                    <p className="text-xs text-gray-500">{emp.role}</p>
                    <div className="flex gap-4 text-xs text-gray-600 mt-1">
                      <span>{emp.total_sessions_today} {t('sesiones')}</span>
                      <span>{emp.total_orders_today} {t('pedidos')}</span>
                      <span>{formatCurrency(emp.total_sales_today)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {t('No hay datos de empleados disponibles')}
            </p>
          )}
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Notificaciones Recientes')}</h3>
          {recentNotifications.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentNotifications.map((notif: any) => (
                <div key={notif.id} className={`flex items-start gap-3 p-3 rounded-lg ${
                  notif.type === 'order_deleted' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                }`}>
                  <span className="text-lg">{notif.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{notif.message}</p>
                    {notif.type === 'order_deleted' && notif.note && (
                      <div className="mt-2 p-2 bg-white rounded border border-red-100">
                        <p className="text-xs font-semibold text-red-600 mb-1">{t('Motivo:')}</p>
                        <p className="text-xs text-gray-700">{notif.note}</p>
                        {notif.total && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {t('Total')}: {formatCurrency(notif.total)}
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notif.timestamp).toLocaleString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {t('No hay notificaciones recientes')}
            </p>
          )}
        </div>

        {/* Sales and Products */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Ventas Diarias (Últimos 7 días)')}</h3>
            {dailySales.length > 0 ? (
              <div className="space-y-3">
                {dailySales.map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {new Date(day.date).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(day.total)}</p>
                      <p className="text-xs text-gray-500">{day.order_count} {t('órdenes')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {t('No hay datos de ventas disponibles')}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Productos Más Vendidos')}</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-600 font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.quantity_sold} {t('unidades')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {t('No hay datos de productos disponibles')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          {t('Insights de Rendimiento')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {financialSummary.length > 0 && (
            <>
              {financialSummary[0].profit_margin < 20 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>{t('Margen bajo hoy:')}</strong> {financialSummary[0].profit_margin.toFixed(1)}%.
                    {t('Considera revisar precios o reducir gastos.')}
                  </p>
                </div>
              )}
              {financialSummary[1].sales < financialSummary[1].expenses && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>{t('Pérdidas esta semana.')}</strong> {t('Los gastos superan las ventas. Revisa el control de inventario y gastos operativos.')}
                  </p>
                </div>
              )}
              {employeeActivity.filter(e => e.total_orders_today === 0 && e.is_online).length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>{t('Empleados inactivos.')}</strong> {t('Algunos empleados conectados no han procesado pedidos hoy.')}
                  </p>
                </div>
              )}
            </>
          )}
          {onlineUsers === 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-800">
                <strong>{t('Ningún empleado conectado.')}</strong> {t('Verifica la conectividad y horarios de trabajo.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

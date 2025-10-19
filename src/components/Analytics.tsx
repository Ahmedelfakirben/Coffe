import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, DollarSign, ShoppingBag, Users, Clock, Activity, AlertTriangle, Bell, Download, FileSpreadsheet } from 'lucide-react';
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

interface ExpenseData {
  date: string;
  amount: number;
  category: string;
  description: string;
}

interface FinancialSummary {
  period: string;
  sales: number;
  expenses: number;
  profit: number;
  profit_margin: number;
}

export function Analytics() {
  const { profile } = useAuth();
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

  useEffect(() => {
    fetchStats();
    fetchDailySales();
    fetchTopProducts();
    fetchEmployeeActivity();
    fetchFinancialSummary();
    fetchRecentNotifications();
    fetchOccupiedTables();
    setupRealtimeSubscriptions();
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

      // Fetch only active employees who haven't been deleted
      const { data: employees, error } = await supabase
        .from('employee_profiles')
        .select(`
          id,
          full_name,
          role,
          active,
          deleted_at,
          created_at
        `)
        .eq('active', true)
        .is('deleted_at', null);

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
              // Get open sessions (not closed) - this determines if user is online
              const { data: openSessions, error: openSessionsError } = await supabase
                .from('cash_register_sessions')
                .select('id, opened_at')
                .eq('employee_id', emp.id)
                .is('closed_at', null);

              if (openSessionsError) {
                console.error('Error fetching open sessions for employee:', emp.id, openSessionsError);
              }

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

              // User is online if they have an open cash session
              const isOnline = openSessions && openSessions.length > 0;

              const lastLogin = openSessions && openSessions.length > 0
                ? openSessions[0].opened_at
                : emp.created_at;

              console.log(`Employee ${emp.full_name}: open sessions: ${openSessions?.length || 0}, isOnline: ${isOnline}, sessions today: ${sessions?.length || 0}, orders today: ${orders?.length || 0}`);

              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: lastLogin,
                total_sessions_today: sessions?.length || 0,
                total_orders_today: orders?.length || 0,
                total_sales_today: totalSales,
                is_online: isOnline,
              };
            } catch (empError) {
              console.error('Error processing employee:', emp.id, empError);
              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: emp.created_at,
                total_sessions_today: 0,
                total_orders_today: 0,
                total_sales_today: 0,
                is_online: false,
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
      { name: 'Hoy', start: new Date(today.toDateString()), end: new Date(today.toDateString() + ' 23:59:59') },
      { name: 'Esta Semana', start: weekAgo, end: today },
      { name: 'Este Mes', start: monthAgo, end: today },
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
    // Get recent cash register sessions (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Get start of today for deleted orders
    const todayStart = new Date().toISOString().split('T')[0];

    const { data: sessions } = await supabase
      .from('cash_register_sessions')
      .select(`
        id,
        opened_at,
        closed_at,
        status,
        employee_profiles!inner(full_name)
      `)
      .gte('opened_at', yesterday.toISOString())
      .order('opened_at', { ascending: false })
      .limit(10);

    // Get deleted orders from today
    const { data: deletedOrders } = await supabase
      .from('deleted_orders')
      .select(`
        id,
        order_number,
        total,
        deletion_note,
        deleted_at,
        employee_profiles!deleted_orders_deleted_by_fkey(full_name)
      `)
      .gte('deleted_at', todayStart)
      .order('deleted_at', { ascending: false })
      .limit(20);

    const sessionNotifications = (sessions || []).map(session => ({
      id: session.id,
      type: session.closed_at ? 'session_closed' : 'session_opened',
      message: session.closed_at
        ? `${(session.employee_profiles as any)?.full_name || 'Empleado'} cerró caja`
        : `${(session.employee_profiles as any)?.full_name || 'Empleado'} abrió caja`,
      timestamp: session.closed_at || session.opened_at,
      icon: session.closed_at ? '🔒' : '🔓',
    }));

    const deletedOrderNotifications = (deletedOrders || []).map(order => ({
      id: `deleted-${order.id}`,
      type: 'order_deleted',
      message: `Pedido #${order.order_number?.toString().padStart(3, '0') || 'N/A'} eliminado por ${(order.employee_profiles as any)?.full_name || 'Admin'}`,
      note: order.deletion_note,
      total: order.total,
      timestamp: order.deleted_at,
      icon: '🗑️',
    }));

    // Combinar y ordenar todas las notificaciones por timestamp
    const allNotifications = [...sessionNotifications, ...deletedOrderNotifications]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15); // Limitar a 15 notificaciones totales

    setRecentNotifications(allNotifications);
  };

  const generateDailyReport = async (summary: FinancialSummary) => {
    try {
      toast.loading('Generando reporte diario...', { id: 'daily-report' });

      const today = new Date();
      const dayStart = new Date(today.toDateString());
      const dayEnd = new Date(today.toDateString() + ' 23:59:59');

      // Get all sessions for today
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          closing_amount,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name)
        `)
        .gte('opened_at', dayStart.toISOString())
        .lte('opened_at', dayEnd.toISOString())
        .order('opened_at', { ascending: true });

      // Get all expenses for today
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .order('created_at', { ascending: true });

      // Get orders for today
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          employee_id,
          order_items (
            quantity,
            unit_price,
            products (name)
          ),
          employee_profiles!inner(full_name)
        `)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      // Calculate totals
      const totalSales = (orders || []).reduce((sum, order) => sum + order.total, 0);
      const totalExpenses = (expenses || []).reduce((sum, exp) => sum + exp.amount, 0);
      const profit = totalSales - totalExpenses;

      // Group sessions by employee
      const employeeSessions = (sessions || []).reduce((acc: any, session) => {
        const empId = session.employee_id;
        if (!acc[empId]) {
          acc[empId] = {
            employee_name: (session.employee_profiles as any)?.full_name || 'N/A',
            sessions: [],
            totalOpening: 0,
            totalClosing: 0,
            firstOpen: session.opened_at,
            lastClose: session.closed_at,
          };
        }
        acc[empId].sessions.push(session);
        acc[empId].totalOpening += session.opening_amount;
        if (session.closing_amount) {
          acc[empId].totalClosing += session.closing_amount;
        }
        if (new Date(session.opened_at) < new Date(acc[empId].firstOpen)) {
          acc[empId].firstOpen = session.opened_at;
        }
        if (session.closed_at && (!acc[empId].lastClose || new Date(session.closed_at) > new Date(acc[empId].lastClose))) {
          acc[empId].lastClose = session.closed_at;
        }
        return acc;
      }, {});

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const headerData = [
        ['🏪 COFFEE SHOP MANAGEMENT SYSTEM'],
        ['📊 REPORTE DIARIO DE OPERACIONES'],
        [''],
        ['📅 FECHA DEL REPORTE:', today.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })],
        ['⏰ HORA DE GENERACIÓN:', today.toLocaleTimeString('es-ES')],
        ['👤 GENERADO POR:', profile?.full_name || 'Sistema'],
        [''],
        ['═'.repeat(50)],
        ['📈 RESUMEN EJECUTIVO'],
        ['═'.repeat(50)]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 8, c: 0 }, e: { r: 8, c: 3 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, 'Portada');

      // Summary Sheet
      const summaryData = [
        ['📊 RESUMEN FINANCIERO DIARIO'],
        [''],
        ['INDICADOR', 'VALOR', 'DETALLE'],
        ['💰 Ventas Totales', `$${totalSales.toFixed(2)}`, `${(orders || []).length} pedidos completados`],
        ['💸 Gastos Totales', `$${totalExpenses.toFixed(2)}`, `${(expenses || []).length} gastos registrados`],
        ['💵 Beneficio Neto', `$${profit.toFixed(2)}`, `${((profit / totalSales) * 100 || 0).toFixed(2)}% margen`],
        ['📦 Productos Vendidos', orders?.reduce((sum, order) =>
          sum + (order.order_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0), 0) || 0, 'unidades'],
        ['👥 Empleados Activos', Object.keys(employeeSessions).length, 'con sesiones de caja'],
        ['🔄 Sesiones de Caja', (sessions || []).length, 'aperturas registradas']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

      // Employee Sessions Sheet
      if (Object.keys(employeeSessions).length > 0) {
        const employeeData = [
          ['👥 SESIONES POR EMPLEADO'],
          [''],
          ['EMPLEADO', 'SESIONES', 'APERTURA PRIMERA', 'CIERRE ÚLTIMO', 'MONTO INICIAL', 'MONTO FINAL', 'DIFERENCIA'],
          ...Object.values(employeeSessions).map((emp: any) => [
            emp.employee_name,
            emp.sessions.length,
            new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Pendiente',
            `$${emp.totalOpening.toFixed(2)}`,
            `$${emp.totalClosing.toFixed(2)}`,
            `$${(emp.totalClosing - emp.totalOpening).toFixed(2)}`
          ])
        ];

        const wsEmployees = XLSX.utils.aoa_to_sheet(employeeData);
        wsEmployees['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsEmployees, 'Empleados');
      }

      // Orders Detail Sheet
      if (orders && orders.length > 0) {
        const ordersData = [
          ['📋 DESGLOSE DETALLADO DE PEDIDOS'],
          [''],
          ['HORA', 'PEDIDO', 'EMPLEADO', 'PRODUCTOS', 'TOTAL'],
          ...orders.map(order => [
            new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            `#${order.id.slice(-8)}`,
            (order.employee_profiles as any)?.full_name || 'N/A',
            order.order_items?.map((item: any) =>
              `${item.quantity}x ${item.products?.[0]?.name || 'Producto'}`
            ).join(', ') || 'Sin productos',
            `$${order.total.toFixed(2)}`
          ])
        ];

        const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
        wsOrders['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos');
      }

      // Expenses Detail Sheet
      if (expenses && expenses.length > 0) {
        const expensesData = [
          ['💸 DESGLOSE DETALLADO DE GASTOS'],
          [''],
          ['HORA', 'DESCRIPCIÓN', 'CATEGORÍA', 'MONTO'],
          ...expenses.map(expense => [
            new Date(expense.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            expense.description,
            expense.category,
            `$${expense.amount.toFixed(2)}`
          ])
        ];

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Gastos');
      }

      // Generate filename with timestamp
      const timestamp = today.toISOString().split('T')[0];
      const filename = `Reporte_Diario_CoffeeShop_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success('Reporte diario generado exitosamente', { id: 'daily-report' });
    } catch (error) {
      console.error('Error generating daily report:', error);
      toast.error('Error al generar el reporte diario', { id: 'daily-report' });
    }
  };

  const generateWeeklyReport = async (summary: FinancialSummary) => {
    try {
      toast.loading('Generando reporte semanal...', { id: 'weekly-report' });

      const currentDate = new Date();
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
      weekEnd.setHours(23, 59, 59, 999);

      // Get all sessions for the week
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          closing_amount,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name)
        `)
        .gte('opened_at', weekStart.toISOString())
        .lte('opened_at', weekEnd.toISOString())
        .order('opened_at', { ascending: true });

      // Get all expenses for the week
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: true });

      // Group sessions by day
      const dailySessions = (sessions || []).reduce((acc: any, session) => {
        const date = new Date(session.opened_at).toDateString();
        const employeeKey = `${date}-${session.employee_id}`;

        if (!acc[employeeKey]) {
          acc[employeeKey] = {
            date,
            employee_id: session.employee_id,
            employee_profiles: session.employee_profiles,
            employee_name: (session.employee_profiles as any)?.full_name || 'N/A',
            sessions: [],
            totalOpening: 0,
            totalClosing: 0,
            firstOpen: session.opened_at,
            lastClose: session.closed_at,
          };
        }
        acc[employeeKey].sessions.push(session);
        acc[employeeKey].totalOpening += session.opening_amount;
        if (session.closing_amount) {
          acc[employeeKey].totalClosing += session.closing_amount;
        }
        if (new Date(session.opened_at) < new Date(acc[employeeKey].firstOpen)) {
          acc[employeeKey].firstOpen = session.opened_at;
        }
        if (session.closed_at && (!acc[employeeKey].lastClose || new Date(session.closed_at) > new Date(acc[employeeKey].lastClose))) {
          acc[employeeKey].lastClose = session.closed_at;
        }
        return acc;
      }, {});

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const headerData = [
        ['🏪 COFFEE SHOP MANAGEMENT SYSTEM'],
        ['📊 REPORTE SEMANAL DE OPERACIONES'],
        [''],
        ['📅 PERIODO DEL REPORTE:', `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`],
        ['📊 SEMANA DEL AÑO:', `Semana ${Math.ceil((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`],
        ['⏰ HORA DE GENERACIÓN:', currentDate.toLocaleTimeString('es-ES')],
        ['👤 GENERADO POR:', profile?.full_name || 'Sistema'],
        [''],
        ['═'.repeat(60)],
        ['📈 RESUMEN EJECUTIVO SEMANAL'],
        ['═'.repeat(60)]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, 'Portada');

      // Summary Sheet
      const summaryData = [
        ['📊 RESUMEN FINANCIERO SEMANAL'],
        [''],
        ['INDICADOR', 'VALOR', 'DETALLE', 'COMPARATIVA'],
        ['💰 Ventas Totales', `$${summary.sales.toFixed(2)}`, 'Ingresos brutos de la semana', '📈'],
        ['💸 Gastos Totales', `$${summary.expenses.toFixed(2)}`, `${expenses?.length || 0} gastos registrados`, '📉'],
        ['💵 Beneficio Neto', `$${summary.profit.toFixed(2)}`, 'Ventas - Gastos', '🎯'],
        ['📊 Margen de Beneficio', `${summary.profit_margin.toFixed(2)}%`, 'Eficiencia operativa', '⭐'],
        ['👥 Empleados Activos', Object.keys(dailySessions).length, 'Con actividad esta semana', '👥'],
        ['🔄 Sesiones de Caja', Object.values(dailySessions).reduce((sum: number, emp: any) => sum + emp.sessions.length, 0), 'Total aperturas de caja', '💼'],
        ['📦 Promedio Diario', `$${(summary.sales / 7).toFixed(2)}`, 'Ventas promedio por día', '📅']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

      // Daily Breakdown Sheet
      if (Object.keys(dailySessions).length > 0) {
        const dailyBreakdown = [
          ['📅 RESUMEN DIARIO POR EMPLEADO'],
          [''],
          ['FECHA', 'EMPLEADO', 'SESIONES', 'APERTURA', 'CIERRE', 'INGRESOS', 'EGRESOS', 'BALANCE']
        ];

        // Group by date and calculate daily totals
        const dailyTotals: any = {};
        Object.values(dailySessions).forEach((emp: any) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          if (!dailyTotals[date]) {
            dailyTotals[date] = { sales: 0, expenses: 0, sessions: 0 };
          }
          dailyTotals[date].sessions += emp.sessions.length;
        });

        Object.entries(dailySessions).forEach(([key, emp]: [string, any]) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          dailyBreakdown.push([
            date,
            emp.employee_name,
            emp.sessions.length,
            new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Pendiente',
            `$${emp.totalOpening.toFixed(2)}`,
            `$${emp.totalClosing.toFixed(2)}`,
            `$${(emp.totalClosing - emp.totalOpening).toFixed(2)}`
          ]);
        });

        const wsDaily = XLSX.utils.aoa_to_sheet(dailyBreakdown);
        wsDaily['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Desglose_Diario');
      }

      // Expenses Detail Sheet
      if (expenses && expenses.length > 0) {
        const expensesData = [
          ['💸 DESGLOSE DETALLADO DE GASTOS SEMANALES'],
          [''],
          ['FECHA', 'DESCRIPCIÓN', 'CATEGORÍA', 'MONTO', 'DÍA DE LA SEMANA']
        ];

        expenses.forEach(expense => {
          const expenseDate = new Date(expense.created_at);
          expensesData.push([
            expenseDate.toLocaleDateString('es-ES'),
            expense.description,
            expense.category,
            `$${expense.amount.toFixed(2)}`,
            expenseDate.toLocaleDateString('es-ES', { weekday: 'long' })
          ]);
        });

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Gastos_Detallados');
      }

      // Generate filename with timestamp
      const weekNumber = Math.ceil((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const filename = `Reporte_Semanal_CoffeeShop_Semana_${weekNumber}_${currentDate.getFullYear()}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success('Reporte semanal generado exitosamente', { id: 'weekly-report' });
    } catch (error) {
      console.error('Error generating weekly report:', error);
      toast.error('Error al generar el reporte semanal', { id: 'weekly-report' });
    }
  };

  const generateMonthlyReport = async (monthlySummary: FinancialSummary) => {
    try {
      toast.loading('Generando reporte mensual...', { id: 'monthly-report' });

      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      // Get all daily sessions for the month
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          closing_amount,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name)
        `)
        .gte('opened_at', monthStart.toISOString())
        .lte('opened_at', monthEnd.toISOString())
        .order('opened_at', { ascending: true });

      // Get all expenses for the month
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: true });

      // Group sessions by day
      const dailySessions = (sessions || []).reduce((acc: any, session) => {
        const date = new Date(session.opened_at).toDateString();
        const employeeKey = `${date}-${session.employee_id}`;

        if (!acc[employeeKey]) {
          acc[employeeKey] = {
            date,
            employee_id: session.employee_id,
            employee_profiles: session.employee_profiles,
            employee_name: (session.employee_profiles as any)?.full_name || 'N/A',
            sessions: [],
            totalOpening: 0,
            totalClosing: 0,
            firstOpen: session.opened_at,
            lastClose: session.closed_at,
          };
        }
        acc[employeeKey].sessions.push(session);
        acc[employeeKey].totalOpening += session.opening_amount;
        if (session.closing_amount) {
          acc[employeeKey].totalClosing += session.closing_amount;
        }
        if (new Date(session.opened_at) < new Date(acc[employeeKey].firstOpen)) {
          acc[employeeKey].firstOpen = session.opened_at;
        }
        if (session.closed_at && (!acc[employeeKey].lastClose || new Date(session.closed_at) > new Date(acc[employeeKey].lastClose))) {
          acc[employeeKey].lastClose = session.closed_at;
        }
        return acc;
      }, {});

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const headerData = [
        ['🏪 COFFEE SHOP MANAGEMENT SYSTEM'],
        ['📊 REPORTE MENSUAL DE OPERACIONES'],
        [''],
        ['📅 PERIODO DEL REPORTE:', `${monthStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`],
        ['📊 MES DEL AÑO:', currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        ['⏰ HORA DE GENERACIÓN:', currentDate.toLocaleTimeString('es-ES')],
        ['👤 GENERADO POR:', profile?.full_name || 'Sistema'],
        [''],
        ['═'.repeat(60)],
        ['📈 RESUMEN EJECUTIVO MENSUAL'],
        ['═'.repeat(60)]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, 'Portada');

      // Summary Sheet
      const summaryData = [
        ['📊 RESUMEN FINANCIERO MENSUAL'],
        [''],
        ['INDICADOR', 'VALOR', 'DETALLE', 'TENDENCIA'],
        ['💰 Ventas Totales', `$${monthlySummary.sales.toFixed(2)}`, 'Ingresos brutos del mes', '📈'],
        ['💸 Gastos Totales', `$${monthlySummary.expenses.toFixed(2)}`, `${expenses?.length || 0} gastos registrados`, '📉'],
        ['💵 Beneficio Neto', `$${monthlySummary.profit.toFixed(2)}`, 'Ventas - Gastos', '🎯'],
        ['📊 Margen de Beneficio', `${monthlySummary.profit_margin.toFixed(2)}%`, 'Eficiencia operativa mensual', '⭐'],
        ['📅 Días de Operación', new Set(Object.values(dailySessions).map((emp: any) => emp.date)).size, 'Días con actividad', '🗓️'],
        ['👥 Empleados Activos', Object.keys(dailySessions).length, 'Con sesiones este mes', '👥'],
        ['🔄 Total Sesiones', Object.values(dailySessions).reduce((sum: number, emp: any) => sum + emp.sessions.length, 0), 'Aperturas de caja', '💼'],
        ['📦 Promedio Diario', `$${(monthlySummary.sales / new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()).toFixed(2)}`, 'Ventas promedio por día', '📅']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

      // Daily Performance Sheet
      if (Object.keys(dailySessions).length > 0) {
        const performanceData = [
          ['📅 RENDIMIENTO DIARIO POR EMPLEADO'],
          [''],
          ['FECHA', 'EMPLEADO', 'SESIONES', 'APERTURA', 'CIERRE', 'INGRESOS', 'EGRESOS', 'BALANCE DIARIO']
        ];

        // Group by date for daily totals
        const dailyTotals: any = {};
        Object.values(dailySessions).forEach((emp: any) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          if (!dailyTotals[date]) {
            dailyTotals[date] = { totalOpening: 0, totalClosing: 0, employees: 0 };
          }
          dailyTotals[date].totalOpening += emp.totalOpening;
          dailyTotals[date].totalClosing += emp.totalClosing;
          dailyTotals[date].employees += 1;
        });

        Object.entries(dailySessions).forEach(([key, emp]: [string, any]) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          performanceData.push([
            date,
            emp.employee_name,
            emp.sessions.length,
            new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Pendiente',
            `$${emp.totalOpening.toFixed(2)}`,
            `$${emp.totalClosing.toFixed(2)}`,
            `$${(emp.totalClosing - emp.totalOpening).toFixed(2)}`
          ]);
        });

        // Add daily totals row
        performanceData.push([''], ['📊 TOTALES DIARIOS']);
        Object.entries(dailyTotals).forEach(([date, totals]: [string, any]) => {
          performanceData.push([
            date,
            `${totals.employees} empleados`,
            '-',
            '-',
            '-',
            `$${totals.totalOpening.toFixed(2)}`,
            `$${totals.totalClosing.toFixed(2)}`,
            `$${(totals.totalClosing - totals.totalOpening).toFixed(2)}`
          ]);
        });

        const wsPerformance = XLSX.utils.aoa_to_sheet(performanceData);
        wsPerformance['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsPerformance, 'Rendimiento_Diario');
      }

      // Monthly Expenses Breakdown
      if (expenses && expenses.length > 0) {
        // Group expenses by category
        const expensesByCategory: any = {};
        expenses.forEach(expense => {
          if (!expensesByCategory[expense.category]) {
            expensesByCategory[expense.category] = { total: 0, count: 0, items: [] };
          }
          expensesByCategory[expense.category].total += expense.amount;
          expensesByCategory[expense.category].count += 1;
          expensesByCategory[expense.category].items.push(expense);
        });

        const expensesData = [
          ['💸 ANÁLISIS DE GASTOS POR CATEGORÍA'],
          [''],
          ['CATEGORÍA', 'TOTAL', 'NÚMERO DE GASTOS', '% DEL TOTAL']
        ];

        const totalExpensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        Object.entries(expensesByCategory).forEach(([category, data]: [string, any]) => {
          expensesData.push([
            category,
            `$${data.total.toFixed(2)}`,
            data.count,
            `${((data.total / totalExpensesAmount) * 100).toFixed(2)}%`
          ]);
        });

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Gastos_Categoria');
      }

      // Generate filename with month and year
      const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const filename = `Reporte_Mensual_CoffeeShop_${monthName.replace(/ /g, '_')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success('Reporte mensual generado exitosamente', { id: 'monthly-report' });
    } catch (error) {
      console.error('Error generating monthly report:', error);
      toast.error('Error al generar el reporte mensual', { id: 'monthly-report' });
    }
  };

  const exportToExcel = async () => {
    try {
      toast.loading('Generando archivo Excel...', { id: 'export' });

      // Fetch all data
      const [ordersData, sessionsData, expensesData, employeesData, productsData] = await Promise.all([
        supabase.from('orders').select(`
          id, total, status, created_at, employee_id,
          employee_profiles!inner(full_name),
          order_items(quantity, unit_price, subtotal, products!inner(name))
        `).order('created_at', { ascending: false }),
        supabase.from('cash_register_sessions').select(`
          id, opening_amount, closing_amount, opened_at, closed_at, status, employee_id,
          employee_profiles!inner(full_name)
        `).order('opened_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('employee_profiles').select('*'),
        supabase.from('products').select(`
          id, name, base_price, available, created_at,
          categories!inner(name)
        `)
      ]);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Orders sheet
      if (ordersData.data) {
        const ordersFormatted = ordersData.data.map(order => ({
          'ID Pedido': order.id,
          'Fecha': new Date(order.created_at).toLocaleString('es-ES'),
          'Estado': order.status,
          'Total': order.total,
          'Empleado': (order.employee_profiles as any)?.full_name || 'N/A',
          'Items': order.order_items?.map(item =>
            `${item.quantity}x ${(item.products as any)?.name || 'Producto'}`
          ).join('; ') || ''
        }));
        const wsOrders = XLSX.utils.json_to_sheet(ordersFormatted);
        XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos');
      }

      // Cash Sessions sheet
      if (sessionsData.data) {
        const sessionsFormatted = sessionsData.data.map(session => ({
          'ID Sesión': session.id,
          'Empleado': (session.employee_profiles as any)?.full_name || 'N/A',
          'Monto Inicial': session.opening_amount,
          'Monto Final': session.closing_amount || 0,
          'Fecha Apertura': new Date(session.opened_at).toLocaleString('es-ES'),
          'Fecha Cierre': session.closed_at ? new Date(session.closed_at).toLocaleString('es-ES') : 'Abierta',
          'Estado': session.status,
          'Balance': (session.closing_amount || 0) - session.opening_amount
        }));
        const wsSessions = XLSX.utils.json_to_sheet(sessionsFormatted);
        XLSX.utils.book_append_sheet(wb, wsSessions, 'Sesiones_Caja');
      }

      // Expenses sheet
      if (expensesData.data) {
        const expensesFormatted = expensesData.data.map(expense => ({
          'ID': expense.id,
          'Descripción': expense.description,
          'Monto': expense.amount,
          'Categoría': expense.category,
          'Fecha': new Date(expense.created_at).toLocaleString('es-ES')
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expensesFormatted);
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Gastos');
      }

      // Employees sheet
      if (employeesData.data) {
        const employeesFormatted = employeesData.data.map(emp => ({
          'ID': emp.id,
          'Nombre Completo': emp.full_name,
          'Rol': emp.role,
          'Email': emp.email || '',
          'Teléfono': emp.phone || '',
          'Activo': emp.active ? 'Sí' : 'No',
          'Fecha Creación': new Date(emp.created_at).toLocaleString('es-ES'),
          'Última Actualización': new Date(emp.updated_at).toLocaleString('es-ES')
        }));
        const wsEmployees = XLSX.utils.json_to_sheet(employeesFormatted);
        XLSX.utils.book_append_sheet(wb, wsEmployees, 'Empleados');
      }

      // Products sheet
      if (productsData.data) {
        const productsFormatted = productsData.data.map(product => ({
          'ID': product.id,
          'Nombre': product.name,
          'Precio Base': product.base_price,
          'Categoría': (product.categories as any)?.name || 'Sin Categoría',
          'Disponible': product.available ? 'Sí' : 'No',
          'Fecha Creación': new Date(product.created_at).toLocaleString('es-ES')
        }));
        const wsProducts = XLSX.utils.json_to_sheet(productsFormatted);
        XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos');
      }

      // Financial Summary sheet
      const financialData = [
        {
          'Período': 'Hoy',
          'Ventas': financialSummary[0]?.sales || 0,
          'Gastos': financialSummary[0]?.expenses || 0,
          'Beneficio': financialSummary[0]?.profit || 0,
          'Margen %': financialSummary[0]?.profit_margin || 0
        },
        {
          'Período': 'Esta Semana',
          'Ventas': financialSummary[1]?.sales || 0,
          'Gastos': financialSummary[1]?.expenses || 0,
          'Beneficio': financialSummary[1]?.profit || 0,
          'Margen %': financialSummary[1]?.profit_margin || 0
        },
        {
          'Período': 'Este Mes',
          'Ventas': financialSummary[2]?.sales || 0,
          'Gastos': financialSummary[2]?.expenses || 0,
          'Beneficio': financialSummary[2]?.profit || 0,
          'Margen %': financialSummary[2]?.profit_margin || 0
        }
      ];
      const wsFinancial = XLSX.utils.json_to_sheet(financialData);
      XLSX.utils.book_append_sheet(wb, wsFinancial, 'Resumen_Financiero');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `CoffeeShop_Report_${timestamp}.xlsx`;

      // Save file directly without opening new window
      XLSX.writeFile(wb, filename);

      toast.success('Archivo Excel generado exitosamente', { id: 'export' });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Error al generar el archivo Excel', { id: 'export' });
    }
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

  const setupRealtimeSubscriptions = () => {
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
      sessionSubscription.unsubscribe();
      orderSubscription.unsubscribe();
      tableSubscription.unsubscribe();
    };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Analíticas y Reportes</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>{onlineUsers} usuarios conectados</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>{occupiedTables} mesas ocupadas</span>
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
          <Bell className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6 opacity-80" />
            <span className="text-xs font-medium opacity-90">Hoy</span>
          </div>
          <p className="text-2xl font-bold mb-1">${stats.todaySales.toFixed(2)}</p>
          <p className="text-xs opacity-90">Ventas del día</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="w-6 h-6 opacity-80" />
            <span className="text-xs font-medium opacity-90">Hoy</span>
          </div>
          <p className="text-2xl font-bold mb-1">{stats.todayOrders}</p>
          <p className="text-xs opacity-90">Órdenes completadas</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-6 h-6 opacity-80" />
            <span className="text-xs font-medium opacity-90">Total</span>
          </div>
          <p className="text-2xl font-bold mb-1">{stats.totalProducts}</p>
          <p className="text-xs opacity-90">Productos activos</p>
        </div>


        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-6 h-6 opacity-80" />
            <span className="text-xs font-medium opacity-90">Activos</span>
          </div>
          <p className="text-2xl font-bold mb-1">{onlineUsers}</p>
          <p className="text-xs opacity-90">Usuarios conectados</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-6 h-6 opacity-80" />
            <span className="text-xs font-medium opacity-90">Ahora</span>
          </div>
          <p className="text-2xl font-bold mb-1">{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-xs opacity-90">Hora actual</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {financialSummary.map((summary, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-6 border">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{summary.period}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Ventas:</span>
                <span className="font-semibold text-green-600">${summary.sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Gastos:</span>
                <span className="font-semibold text-red-600">${summary.expenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium text-gray-900">Beneficio:</span>
                <span className={`font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${summary.profit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Margen:</span>
                <span className={`font-semibold ${summary.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profit_margin.toFixed(1)}%
                </span>
              </div>
              <div className="mt-4 pt-4 border-t">
                {summary.period === 'Hoy' && (
                  <button
                    onClick={() => generateDailyReport(summary)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Generar Reporte Diario
                  </button>
                )}
                {summary.period === 'Esta Semana' && (
                  <button
                    onClick={() => generateWeeklyReport(summary)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Generar Reporte Semanal
                  </button>
                )}
                {summary.period === 'Este Mes' && (
                  <button
                    onClick={() => generateMonthlyReport(summary)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Generar Reporte Mensual
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
          <h3 className="text-lg font-bold text-gray-900 mb-4">Actividad de Empleados</h3>
          {employeeActivity.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {employeeActivity.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${emp.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{emp.full_name}</p>
                    <p className="text-xs text-gray-500">{emp.role}</p>
                    <div className="flex gap-4 text-xs text-gray-600 mt-1">
                      <span>{emp.total_sessions_today} sesiones</span>
                      <span>{emp.total_orders_today} pedidos</span>
                      <span>${emp.total_sales_today.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay datos de empleados disponibles
            </p>
          )}
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Notificaciones Recientes</h3>
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
                        <p className="text-xs font-semibold text-red-600 mb-1">Motivo:</p>
                        <p className="text-xs text-gray-700">{notif.note}</p>
                        {notif.total && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            Total: ${notif.total.toFixed(2)}
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
              No hay notificaciones recientes
            </p>
          )}
        </div>

        {/* Sales and Products */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ventas Diarias (Últimos 7 días)</h3>
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
                      <p className="font-semibold text-gray-900">${day.total.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{day.order_count} órdenes</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay datos de ventas disponibles
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Productos Más Vendidos</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-600 font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.quantity_sold} unidades</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600">${product.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay datos de productos disponibles
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Insights de Rendimiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {financialSummary.length > 0 && (
            <>
              {financialSummary[0].profit_margin < 20 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Margen bajo hoy:</strong> {financialSummary[0].profit_margin.toFixed(1)}%.
                    Considera revisar precios o reducir gastos.
                  </p>
                </div>
              )}
              {financialSummary[1].sales < financialSummary[1].expenses && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Pérdidas esta semana.</strong> Los gastos superan las ventas.
                    Revisa el control de inventario y gastos operativos.
                  </p>
                </div>
              )}
              {employeeActivity.filter(e => e.total_orders_today === 0 && e.is_online).length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Empleados inactivos.</strong> Algunos empleados conectados no han procesado pedidos hoy.
                  </p>
                </div>
              )}
            </>
          )}
          {onlineUsers === 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-800">
                <strong>Ningún empleado conectado.</strong> Verifica la conectividad y horarios de trabajo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

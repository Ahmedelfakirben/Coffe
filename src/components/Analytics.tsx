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
      const { data: employees, error } = await supabase
        .from('employee_profiles')
        .select(`
          id,
          full_name,
          role,
          updated_at
        `);

      if (error) {
        console.error('Error fetching employees:', error);
        setEmployeeActivity([]);
        setOnlineUsers(0);
        return;
      }

      if (employees && employees.length > 0) {
        const activityData = await Promise.all(
          employees.map(async (emp) => {
            try {
              // Get open sessions (not closed) - this determines if user is online
              const { data: openSessions, error: openSessionsError } = await supabase
                .from('cash_register_sessions')
                .select('id')
                .eq('employee_id', emp.id)
                .is('closed_at', null);
    
              if (openSessionsError) {
                console.error('Error fetching open sessions for employee:', emp.id, openSessionsError);
              }
    
              // Get sessions today
              const today = new Date().toISOString().split('T')[0];
              const { data: sessions, error: sessionsError } = await supabase
                .from('cash_register_sessions')
                .select('id')
                .eq('employee_id', emp.id)
                .gte('opened_at', today);
    
              if (sessionsError) {
                console.error('Error fetching sessions for employee:', emp.id, sessionsError);
              }
    
              // Get orders today
              const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('total')
                .eq('employee_id', emp.id)
                .gte('created_at', today)
                .eq('status', 'completed');
    
              if (ordersError) {
                console.error('Error fetching orders for employee:', emp.id, ordersError);
              }
    
              const totalSales = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
    
              // Consider online if they have an open cash session OR were active in last 15 minutes
              const hasOpenSession = openSessions && openSessions.length > 0;
              const recentlyActive = new Date(emp.updated_at) > new Date(Date.now() - 15 * 60 * 1000);
              const isOnline = hasOpenSession || recentlyActive;
    
              console.log(`Employee ${emp.full_name}: open sessions: ${openSessions?.length || 0}, recently active: ${recentlyActive}, isOnline: ${isOnline}`);
    
              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: emp.updated_at,
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
                last_login: emp.updated_at,
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

        setEmployeeActivity(activityData);
        setOnlineUsers(onlineCount);
      } else {
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

    const notifications = (sessions || []).map(session => ({
      id: session.id,
      type: session.closed_at ? 'session_closed' : 'session_opened',
      message: session.closed_at
        ? `${(session.employee_profiles as any)?.full_name || 'Empleado'} cerró caja`
        : `${(session.employee_profiles as any)?.full_name || 'Empleado'} abrió caja`,
      timestamp: session.closed_at || session.opened_at,
      icon: session.closed_at ? '🔒' : '🔓',
    }));

    setRecentNotifications(notifications);
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

      // Create daily report content
      const reportContent = `
        <div style="font-family: monospace; max-width: 400px; margin: 0 auto; padding: 10px;">
          <h1 style="text-align: center; margin-bottom: 10px; font-size: 18px;">REPORTE DIARIO</h1>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>Fecha:</strong> ${today.toLocaleDateString('es-ES')}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RESUMEN DEL DÍA</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Ventas:</strong> $${totalSales.toFixed(2)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Gastos:</strong> $${totalExpenses.toFixed(2)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Beneficio Neto:</strong> $${profit.toFixed(2)}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Pedidos Completados:</strong> ${(orders || []).length}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>SESIONES POR EMPLEADO</strong>
          </div>

          ${Object.values(employeeSessions).map((emp: any) => `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div><strong>${emp.employee_name}</strong></div>
              <div style="font-size: 12px; margin-top: 3px;">
                Primera apertura: ${new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style="font-size: 12px;">
                Último cierre: ${emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Sin cerrar'}
              </div>
              <div style="font-size: 12px;">
                Total inicial: $${emp.totalOpening.toFixed(2)} | Total final: $${emp.totalClosing.toFixed(2)}
              </div>
              <div style="font-size: 12px;">
                Resultado: $${(emp.totalClosing - emp.totalOpening).toFixed(2)} | Sesiones: ${emp.sessions.length}
              </div>
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>DESGLOSE DE PEDIDOS</strong>
          </div>

          ${(orders || []).map(order => `
            <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
              <div><strong>Pedido #${order.id.slice(-8)}</strong></div>
              <div style="font-size: 12px;">Empleado: ${(order.employee_profiles as any)?.full_name || 'N/A'}</div>
              <div style="font-size: 12px;">Hora: ${new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
              <div style="font-size: 12px;">Total: $${order.total.toFixed(2)}</div>
              <div style="font-size: 12px; margin-top: 3px;">
                ${order.order_items?.map((item: any) => `${item.quantity}x ${item.products?.[0]?.name || 'Producto'}`).join(', ')}
              </div>
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>GASTOS DEL DÍA</strong>
          </div>

          ${expenses?.map(expense => `
            <div style="margin-bottom: 5px; font-size: 12px;">
              ${new Date(expense.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${expense.description}: $${expense.amount.toFixed(2)}
            </div>
          `).join('') || '<div style="font-size: 12px;">No hay gastos registrados hoy</div>'}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            Generado el ${new Date().toLocaleString('es-ES')}
          </div>
        </div>
      `;

      // Print directly without opening new window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reporte Diario</title>
              <style>
                @media print {
                  body { margin: 0; }
                  @page { size: auto; margin: 5mm; }
                }
              </style>
            </head>
            <body>
              ${reportContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        // Close window after printing
        printWindow.onafterprint = () => printWindow.close();
      }

      toast.success('Reporte diario generado', { id: 'daily-report' });
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

      // Create weekly report content
      const reportContent = `
        <div style="font-family: monospace; max-width: 400px; margin: 0 auto; padding: 10px;">
          <h1 style="text-align: center; margin-bottom: 10px; font-size: 18px;">REPORTE SEMANAL</h1>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>Semana:</strong> ${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RESUMEN SEMANAL</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Ventas:</strong> $${summary.sales.toFixed(2)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Gastos:</strong> $${summary.expenses.toFixed(2)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Beneficio Neto:</strong> $${summary.profit.toFixed(2)}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Margen de Beneficio:</strong> ${summary.profit_margin.toFixed(1)}%
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RESUMEN DIARIO POR EMPLEADO</strong>
          </div>

          ${Object.values(dailySessions).map((day: any) => `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div><strong>${new Date(day.date).toLocaleDateString('es-ES')} - ${day.employee_name}</strong></div>
              <div style="font-size: 12px; margin-top: 3px;">
                Primera apertura: ${new Date(day.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style="font-size: 12px;">
                Último cierre: ${day.lastClose ? new Date(day.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Sin cerrar'}
              </div>
              <div style="font-size: 12px;">
                Total inicial: $${day.totalOpening.toFixed(2)} | Total final: $${day.totalClosing.toFixed(2)}
              </div>
              <div style="font-size: 12px;">
                Resultado día: $${(day.totalClosing - day.totalOpening).toFixed(2)} | Sesiones: ${day.sessions.length}
              </div>
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>DESGLOSE DE GASTOS</strong>
          </div>

          ${expenses?.map(expense => `
            <div style="margin-bottom: 5px; font-size: 12px;">
              ${new Date(expense.created_at).toLocaleDateString('es-ES')} - ${expense.description}: $${expense.amount.toFixed(2)}
            </div>
          `).join('') || '<div style="font-size: 12px;">No hay gastos registrados esta semana</div>'}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            Generado el ${new Date().toLocaleString('es-ES')}
          </div>
        </div>
      `;

      // Print directly without opening new window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reporte Semanal</title>
              <style>
                @media print {
                  body { margin: 0; }
                  @page { size: auto; margin: 5mm; }
                }
              </style>
            </head>
            <body>
              ${reportContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        // Close window after printing
        printWindow.onafterprint = () => printWindow.close();
      }

      toast.success('Reporte semanal generado', { id: 'weekly-report' });
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

      // Create monthly report content
      const reportContent = `
        <div style="font-family: monospace; max-width: 400px; margin: 0 auto; padding: 10px;">
          <h1 style="text-align: center; margin-bottom: 10px; font-size: 18px;">REPORTE MENSUAL DE CAJA</h1>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>Mes:</strong> ${currentDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RESUMEN MENSUAL</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Ventas:</strong> $${monthlySummary.sales.toFixed(2)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Gastos:</strong> $${monthlySummary.expenses.toFixed(2)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Beneficio Neto:</strong> $${monthlySummary.profit.toFixed(2)}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Margen de Beneficio:</strong> ${monthlySummary.profit_margin.toFixed(1)}%
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RESUMEN DIARIO POR EMPLEADO</strong>
          </div>

          ${Object.values(dailySessions).map((day: any) => `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div><strong>${new Date(day.date).toLocaleDateString('es-ES')} - ${(day.employee_profiles as any)?.full_name || day.employee_name || 'N/A'}</strong></div>
              <div style="font-size: 12px; margin-top: 3px;">
                Primera apertura: ${new Date(day.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style="font-size: 12px;">
                Último cierre: ${day.lastClose ? new Date(day.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Sin cerrar'}
              </div>
              <div style="font-size: 12px;">
                Total inicial: $${day.totalOpening.toFixed(2)} | Total final: $${day.totalClosing.toFixed(2)}
              </div>
              <div style="font-size: 12px;">
                Resultado día: $${(day.totalClosing - day.totalOpening).toFixed(2)} | Sesiones: ${day.sessions.length}
              </div>
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>DESGLOSE DE GASTOS</strong>
          </div>

          ${expenses?.map(expense => `
            <div style="margin-bottom: 5px; font-size: 12px;">
              ${new Date(expense.created_at).toLocaleDateString('es-ES')} - ${expense.description}: $${expense.amount.toFixed(2)}
            </div>
          `).join('') || '<div style="font-size: 12px;">No hay gastos registrados este mes</div>'}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            Generado el ${new Date().toLocaleString('es-ES')}
          </div>
        </div>
      `;

      // Print directly without opening new window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reporte Mensual de Caja</title>
              <style>
                @media print {
                  body { margin: 0; }
                  @page { size: auto; margin: 5mm; }
                }
              </style>
            </head>
            <body>
              ${reportContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        // Close window after printing
        printWindow.onafterprint = () => printWindow.close();
      }

      toast.success('Reporte mensual generado', { id: 'monthly-report' });
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
              {recentNotifications.map((notif) => (
                <div key={notif.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">{notif.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{notif.message}</p>
                    <p className="text-xs text-gray-500">
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

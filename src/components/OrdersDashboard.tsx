import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCircle, XCircle, Banknote, CreditCard, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TicketPrinter } from './TicketPrinter';
import { useLanguage } from '../contexts/LanguageContext';

interface Order {
  id: string;
  status: 'preparing' | 'completed' | 'cancelled';
  total: number;
  payment_method: string;
  created_at: string;
  employee_id: string;
  order_number?: number;
  table_id?: string | null;
  service_type?: string;
  employee_profiles?: {
    full_name: string;
    role: string;
  };
}

interface OrderHistory {
  id: string;
  order_id: string;
  action: 'created' | 'updated' | 'completed' | 'cancelled';
  status: string;
  total: number;
  created_at: string;
  employee_id?: string;
  order_number?: number;
  employee_profiles?: {
    full_name: string;
  };
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  products: {
    name: string;
  };
  product_sizes?: {
    size_name: string;
  } | null;
}

interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

interface CashEvent {
  id: string;
  type: 'open' | 'close';
  amount: number;
  date: string;
  employee_id: string;
  employee_name: string;
  note?: string | null;
}

export function OrdersDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('preparing');
  const [viewMode, setViewMode] = useState<'current' | 'history' | 'cash'>('current');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [employees, setEmployees] = useState<{id:string; full_name:string}[]>([]);
  const [showLatestOnly, setShowLatestOnly] = useState<boolean>(true);
  const [cashEvents, setCashEvents] = useState<CashEvent[]>([]);
  const [selectedCashType, setSelectedCashType] = useState<'all' | 'open' | 'close'>('all');
  const [selectedCashUserId, setSelectedCashUserId] = useState<string>('all');
  const [selectedCashDateRange, setSelectedCashDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Estado para modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderWithItems | null>(null);
  const [deletionNote, setDeletionNote] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Estado para modal de pago y ticket
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderToComplete, setOrderToComplete] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [ticketData, setTicketData] = useState<{
    orderDate: Date;
    orderNumber: string;
    items: Array<{ name: string; size?: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    cashierName: string;
  } | null>(null);

  // Function to get the last 2 AM timestamp (24-hour window for cashiers)
  const getLast2AMTimestamp = () => {
    const now = new Date();
    const today2AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0);
    
    // If current time is before 2 AM today, use yesterday's 2 AM
    if (now < today2AM) {
      today2AM.setDate(today2AM.getDate() - 1);
    }
    
    return today2AM.toISOString();
  };

  useEffect(() => {
    // Solo cargar lo que se necesita según el viewMode
    if (viewMode === 'current' || viewMode === 'history') {
      fetchOrders();
    }
    if (viewMode === 'history') {
      fetchOrderHistory();
    }
    fetchEmployees();

    // Suscripción en tiempo real optimizada
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          // Solo refrescar según el modo actual
          if (viewMode === 'current' || viewMode === 'history') {
            fetchOrders();
          }
          if (viewMode === 'history') {
            fetchOrderHistory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate, viewMode]);

  // Redirect cashier users to current view if they somehow access history
  useEffect(() => {
    if (profile?.role === 'cashier' && viewMode !== 'current') {
      setViewMode('current');
    }
  }, [profile, viewMode]);

  useEffect(() => {
    if (viewMode === 'cash') {
      fetchCashSessions();
    }
  }, [viewMode]);

  // Limpiar ticketData después de imprimir usando eventos
  useEffect(() => {
    if (ticketData) {
      console.log('🎫 ORDERS: Ticket establecido, esperando impresión...');

      let cleaned = false;

      // Escuchar evento de impresión completada
      const handleTicketPrinted = () => {
        if (!cleaned) {
          console.log('🎫 ORDERS: Evento ticketPrinted recibido, limpiando ticket');
          cleaned = true;
          setTicketData(null);
        }
      };

      // Timeout de fallback de 10 segundos por si el evento no se dispara
      const timer = setTimeout(() => {
        if (!cleaned) {
          console.log('🎫 ORDERS: Timeout alcanzado, limpiando ticket (fallback)');
          cleaned = true;
          setTicketData(null);
        }
      }, 10000);

      window.addEventListener('ticketPrinted', handleTicketPrinted);

      return () => {
        console.log('🎫 ORDERS: Cleanup - removiendo listener y timer');
        window.removeEventListener('ticketPrinted', handleTicketPrinted);
        clearTimeout(timer);
      };
    }
  }, [ticketData]);

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase
        .from('employee_profiles')
        .select('id, full_name')
        .order('full_name');
      setEmployees(data || []);
    } catch (err) {
      console.error('Error al obtener empleados:', err);
    }
  };

  const fetchOrderHistory = async () => {
    try {
      let query = supabase
        .from('order_history')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtro de fecha personalizado
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        // Add one day to end date to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        query = query.lt('created_at', endDateTime.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Obtener IDs únicos de empleados y orders
        const uniqueEmployeeIds = [...new Set(data.map(h => h.employee_id).filter(Boolean))];
        const uniqueOrderIds = [...new Set(data.map(h => h.order_id).filter(Boolean))];

        // Hacer queries en paralelo para empleados y orders
        const [employeesResult, ordersResult] = await Promise.all([
          supabase
            .from('employee_profiles')
            .select('id, full_name')
            .in('id', uniqueEmployeeIds),
          supabase
            .from('orders')
            .select('id, order_number')
            .in('id', uniqueOrderIds)
        ]);

        // Crear mapas para búsqueda rápida O(1)
        const employeesMap = new Map(
          (employeesResult.data || []).map(emp => [emp.id, emp])
        );
        const ordersMap = new Map(
          (ordersResult.data || []).map(order => [order.id, order])
        );

        // Mapear los datos a history
        const historyWithData = data.map((history: any) => ({
          ...history,
          employee_profiles: history.employee_id ? employeesMap.get(history.employee_id) : null,
          order_number: ordersMap.get(history.order_id)?.order_number
        }));

        setOrderHistory(historyWithData);
      } else {
        setOrderHistory([]);
      }
    } catch (err) {
      console.error('Error al obtener historial:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      console.log('Iniciando búsqueda de órdenes...');

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            quantity,
            unit_price,
            subtotal,
            products!product_id(
              name
            ),
            product_sizes!size_id(
              size_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Mostrar últimas 24 horas desde las 2 AM en vista actual
      if (viewMode === 'current') {
        const last2AM = getLast2AMTimestamp();
        query = query.gte('created_at', last2AM);
      }

      query = query.limit(50);

      const { data, error } = await query;

      if (error) {
        console.error('Error al obtener órdenes:', error);
        return;
      }

      if (data && data.length > 0) {
        // Obtener IDs únicos de empleados
        const uniqueEmployeeIds = [...new Set(data.map(order => order.employee_id).filter(Boolean))];

        // Hacer una sola query para todos los empleados
        const { data: employeesData } = await supabase
          .from('employee_profiles')
          .select('id, full_name, role')
          .in('id', uniqueEmployeeIds);

        // Crear un mapa de empleados para búsqueda rápida O(1)
        const employeesMap = new Map(
          (employeesData || []).map(emp => [emp.id, emp])
        );

        // Mapear los datos de empleados a las órdenes
        const ordersWithEmployees = data.map(order => ({
          ...order,
          employee_profiles: order.employee_id ? employeesMap.get(order.employee_id) : null
        }));

        console.log('Órdenes con empleados:', ordersWithEmployees);
        setOrders(ordersWithEmployees as OrderWithItems[]);
      } else {
        setOrders([]);
      }

    } catch (err) {
      console.error('Error en fetchOrders:', err);
    }
  };

  const fetchCashSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          opening_note,
          opening_time,
          closing_amount,
          closing_note,
          closing_time,
          created_at,
          employee_profiles!employee_id(
            full_name
          )
        `)
        .order('opening_time', { ascending: false });

      if (error) throw error;

      const events: CashEvent[] = [];
      (data || []).forEach((s: any) => {
        if (s.opening_time) {
          events.push({
            id: `${s.id}-open`,
            type: 'open',
            amount: Number(s.opening_amount ?? 0),
            date: s.opening_time,
            employee_id: s.employee_id,
            employee_name: s.employee_profiles?.full_name ?? 'N/A',
            note: s.opening_note ?? null,
          });
        }
        if (s.closing_time) {
          events.push({
            id: `${s.id}-close`,
            type: 'close',
            amount: Number(s.closing_amount ?? 0),
            date: s.closing_time,
            employee_id: s.employee_id,
            employee_name: s.employee_profiles?.full_name ?? 'N/A',
            note: s.closing_note ?? null,
          });
        }
      });
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCashEvents(events);
    } catch (err) {
      console.error('Error al obtener sesiones de caja:', err);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    // If completing an order, show payment method modal first
    if (newStatus === 'completed') {
      setOrderToComplete(orderId);
      setShowPaymentModal(true);
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast.error(t('Error al actualizar el estado'));
      return;
    }
    fetchOrders();
  };

  const completeOrderWithPayment = async () => {
    if (!orderToComplete || !selectedPaymentMethod) return;

    try {
      // Primero obtener la orden para saber si tiene mesa asignada
      const order = orders.find(o => o.id === orderToComplete);

      // Actualizar el pedido a completado con el método de pago
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_method: selectedPaymentMethod
        })
        .eq('id', orderToComplete);

      if (error) {
        console.error('Error updating order:', error);
        toast.error(`${t('Error al completar la orden:')} ${error.message}`);
        return;
      }

      // Si la orden tiene mesa asignada, liberar la mesa
      if (order?.table_id) {
        console.log('Liberando mesa:', order.table_id);
        const { error: tableError } = await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', order.table_id);

        if (tableError) {
          console.error('Error al liberar la mesa:', tableError);
          // No bloqueamos el flujo si falla la actualización de la mesa
        } else {
          console.log('Mesa liberada exitosamente');
        }
      }

      // Prepare ticket data for TicketPrinter component
      if (order) {
        // Obtener información del cajero
        const cashierName = order.employee_profiles?.full_name || user?.email || 'Usuario';

        // Preparar items del pedido
        const ticketItems = (order.order_items || []).map(item => {
          // Usar unit_price si está disponible, sino calcular desde subtotal
          const unitPrice = Number(item.unit_price || 0) || (item.quantity > 0 ? Number(item.subtotal || 0) / item.quantity : 0);

          return {
            name: item.products?.name || 'Producto',
            size: item.product_sizes?.size_name || undefined,
            quantity: item.quantity || 0,
            price: unitPrice
          };
        });

        // Formatear método de pago
        const paymentMethodText = selectedPaymentMethod === 'cash' ? 'Efectivo' :
                                  selectedPaymentMethod === 'card' ? 'Tarjeta' : 'Digital';

        // Preparar datos del ticket
        setTicketData({
          orderDate: new Date(order.created_at),
          orderNumber: order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8),
          items: ticketItems,
          total: order.total,
          paymentMethod: paymentMethodText,
          cashierName: cashierName
        });
      }

      setShowPaymentModal(false);
      setOrderToComplete(null);
      setSelectedPaymentMethod('');
      fetchOrders();
      toast.success(t('Orden completada exitosamente'));
    } catch (err) {
      console.error('Error al completar orden:', err);
      toast.error(t('Error al completar la orden'));
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete || !user || !deletionNote.trim()) {
      toast.error(t('Debe ingresar una nota de eliminación'));
      return;
    }

    setDeleteLoading(true);
    try {
      // Preparar los items del pedido en formato JSON
      const itemsData = orderToDelete.order_items.map(item => ({
        quantity: item.quantity,
        product_name: item.products?.name || 'Producto',
        size_name: item.product_sizes?.size_name || null
      }));

      // Insertar registro en deleted_orders
      const { error: insertError } = await supabase
        .from('deleted_orders')
        .insert({
          order_id: orderToDelete.id,
          order_number: orderToDelete.order_number,
          total: orderToDelete.total,
          items: itemsData,
          deleted_by: user.id,
          deletion_note: deletionNote.trim()
        });

      if (insertError) throw insertError;

      // Eliminar el pedido de la tabla orders
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (deleteError) throw deleteError;

      toast.success(t('Pedido eliminado correctamente'));
      setShowDeleteModal(false);
      setOrderToDelete(null);
      setDeletionNote('');
      fetchOrders();
    } catch (error: any) {
      console.error('Error eliminando pedido:', error);
      toast.error(`${t('Error al eliminar pedido:')} ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => o.status === selectedStatus);

  const filteredHistory = selectedUserId === 'all'
    ? orderHistory
    : orderHistory.filter(h => h.employee_id === selectedUserId);

  const latestByOrder = (() => {
    const map = new Map<string, OrderHistory>();
    for (const h of filteredHistory) {
      const prev = map.get(h.order_id);
      if (!prev || new Date(h.created_at).getTime() > new Date(prev.created_at).getTime()) {
        map.set(h.order_id, h);
      }
    }
    return Array.from(map.values());
  })();

  const historyToRender = showLatestOnly ? latestByOrder : filteredHistory;

  const filteredCashEvents = (() => {
    let events = cashEvents;

    if (selectedCashType !== 'all') {
      events = events.filter(e => e.type === selectedCashType);
    }

    if (selectedCashUserId !== 'all') {
      events = events.filter(e => e.employee_id === selectedCashUserId);
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    if (selectedCashDateRange === 'today') {
      events = events.filter(e => e.date >= startOfDay);
    } else if (selectedCashDateRange === 'week') {
      events = events.filter(e => e.date >= startOfWeek);
    } else if (selectedCashDateRange === 'month') {
      events = events.filter(e => e.date >= startOfMonth);
    }

    return events;
  })();

  const totals = {
    day: historyToRender
      .filter(h => new Date(h.created_at) >= new Date(new Date().setHours(0,0,0,0)) && h.action !== 'cancelled')
      .reduce((sum, h) => sum + h.total, 0),
    week: historyToRender
      .filter(h => new Date(h.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && h.action !== 'cancelled')
      .reduce((sum, h) => sum + h.total, 0),
    month: historyToRender
      .filter(h => new Date(h.created_at).getMonth() === new Date().getMonth() && new Date(h.created_at).getFullYear() === new Date().getFullYear() && h.action !== 'cancelled')
      .reduce((sum, h) => sum + h.total, 0),
  };

  const printReport = () => {
    const content = `Resultados\nHoy: $${totals.day.toFixed(2)}\nSemana: $${totals.week.toFixed(2)}\nMes: $${totals.month.toFixed(2)}`;
    const w = window.open('', '', 'height=600,width=800');
    if (!w) return;
    w.document.write(`<pre style="font-family: monospace; padding: 16px;">${content}</pre>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const getStatusColor = (status: string) => {
    const colors = {
      preparing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status as keyof typeof colors] || colors.preparing;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing':
        return <Clock className="w-5 h-5" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const statusLabels = {
    preparing: t('En Preparación'),
    completed: t('Completado'),
    cancelled: t('Cancelado'),
  };

  return (
    <div className="p-3 md:p-6">
      <div className="mb-4 md:mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('Panel de Órdenes')}</h2>

        {/* Selector de vista */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setViewMode('current')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'current'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t('Órdenes Actuales')}
          </button>
          {/* Hide Historial button for cashier users */}
          {profile?.role !== 'cashier' && (
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'history'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t('Historial')}
            </button>
          )}
        </div>

        {viewMode === 'current' ? (
          <div className="flex gap-2 flex-wrap justify-center md:justify-start">
            {Object.entries(statusLabels).map(([status, label]) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
                  selectedStatus === status
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : viewMode === 'history' ? (
          <div className="flex gap-4 flex-wrap items-center mb-6">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">{t('Desde:')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">{t('Hasta:')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={fetchOrderHistory}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                {t('Filtrar')}
              </button>
            </div>

            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="all">{t('Todos los usuarios')}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLatestOnly}
                onChange={(e) => setShowLatestOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t('Mostrar últimas por orden')}
            </label>

            <div className="flex gap-2 items-center ml-auto">
              <div className="px-4 py-2 rounded-lg border bg-white shadow-sm">
                <span className="font-medium text-gray-700">{t('Hoy:')}</span>
                <span className="font-bold text-amber-600 ml-1">${totals.day.toFixed(2)}</span>
              </div>
              <div className="px-4 py-2 rounded-lg border bg-white shadow-sm">
                <span className="font-medium text-gray-700">{t('Semana:')}</span>
                <span className="font-bold text-amber-600 ml-1">${totals.week.toFixed(2)}</span>
              </div>
              <div className="px-4 py-2 rounded-lg border bg-white shadow-sm">
                <span className="font-medium text-gray-700">{t('Mes:')}</span>
                <span className="font-bold text-amber-600 ml-1">${totals.month.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedCashType}
              onChange={(e) => setSelectedCashType(e.target.value as any)}
              className="px-4 py-2 rounded-lg border"
            >
              <option value="all">{t('Todos')}</option>
              <option value="open">{t('Aperturas')}</option>
              <option value="close">{t('Cierres')}</option>
            </select>
            <select
              value={selectedCashUserId}
              onChange={(e) => setSelectedCashUserId(e.target.value)}
              className="px-4 py-2 rounded-lg border"
            >
              <option value="all">{t('Todos los usuarios')}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            {['today', 'week', 'month', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setSelectedCashDateRange(range as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCashDateRange === range
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {range === 'today' && t('Hoy')}
                {range === 'week' && t('Esta Semana')}
                {range === 'month' && t('Este Mes')}
                {range === 'all' && t('Todo')}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'current' ? (
        filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">{t('No hay órdenes para mostrar')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-4 ${getStatusColor(order.status)}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(order.status)}
                      <span className="font-semibold">
                        {statusLabels[order.status as keyof typeof statusLabels]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(order.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">
                      ${order.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mb-3 space-y-1">
                  {order.order_items?.map(item => (
                    <div key={item.id} className="text-sm flex justify-between">
                      <span>
                        {item.quantity}x {item.products?.name}
                        {item.product_sizes && ` (${item.product_sizes.size_name})`}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs text-gray-600">
                    {t('Empleado:')} {order.employee_profiles?.full_name || profile?.full_name || (user?.email ?? 'N/A')}
                  </p>

                  {order.status === 'preparing' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="flex-1 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        {t('Completar')}
                      </button>
                      <button
                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        {t('Cancelar')}
                      </button>
                    </div>
                  )}

                  {order.status === 'completed' && (profile?.role === 'admin' || profile?.role === 'super_admin') && (
                    <button
                      onClick={() => {
                        setOrderToDelete(order);
                        setShowDeleteModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('Eliminar Pedido')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : viewMode === 'history' ? (
        orderHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">{t('No hay historial de órdenes para mostrar')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('Orden')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('Fecha')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('Estado')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('Acción')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('Total')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('Empleado')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyToRender.map(history => (
                    <tr key={history.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{history.order_number ? history.order_number.toString().padStart(3, '0') : history.order_id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(history.created_at).toLocaleString('es-ES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(history.status)}`}>
                          {statusLabels[history.status as keyof typeof statusLabels]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {history.action === 'created' && t('Creada')}
                        {history.action === 'updated' && t('Actualizada')}
                        {history.action === 'completed' && t('Completada')}
                        {history.action === 'cancelled' && t('Cancelada')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-600">
                        ${history.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {history.employee_profiles?.full_name || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        filteredCashEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">{t('No hay eventos de caja')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCashEvents.map(event => (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm border-2 p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {event.type === 'open' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-amber-600" />
                      )}
                      <span className="font-semibold">
                        {event.type === 'open' ? t('Apertura') : t('Cierre')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(event.date).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">
                      ${event.amount.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm">
                    <span className="font-medium">{t('Empleado:')}</span> {event.employee_name}
                  </p>
                  {event.note && (
                    <p className="text-xs text-gray-600 mt-2">
                      {t('Nota:')} {event.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Delete Order Modal */}
      {showDeleteModal && orderToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('Eliminar Pedido')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('¿Está seguro de eliminar el pedido')} #{orderToDelete.order_number?.toString().padStart(3, '0') || orderToDelete.id.slice(-8)}?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-amber-800 mb-2">{t('Detalles del pedido:')}</p>
              <div className="space-y-1 text-sm text-gray-700">
                {orderToDelete.order_items.map((item, idx) => (
                  <div key={idx}>
                    {item.quantity}x {item.products?.name}
                    {item.product_sizes && ` (${item.product_sizes.size_name})`}
                  </div>
                ))}
                <div className="font-bold text-amber-600 pt-2 border-t border-amber-300">
                  {t('Total:')} ${orderToDelete.total.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Nota de eliminación (obligatoria):')}
              </label>
              <textarea
                value={deletionNote}
                onChange={(e) => setDeletionNote(e.target.value)}
                placeholder={t('Ingrese la razón de la eliminación...')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {deletionNote.length}/500 {t('caracteres')}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setOrderToDelete(null);
                  setDeletionNote('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={deleteLoading}
              >
                {t('Cancelar')}
              </button>
              <button
                onClick={handleDeleteOrder}
                disabled={deleteLoading || !deletionNote.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('Eliminando...')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('Eliminar Pedido')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('Seleccionar Método de Pago')}</h2>

            <div className="grid grid-cols-1 gap-3 mb-6">
              <button
                onClick={() => {
                  setSelectedPaymentMethod('cash');
                  completeOrderWithPayment();
                }}
                className="flex items-center gap-3 p-4 rounded-lg border-2 bg-white transition-colors hover:border-amber-600 hover:bg-amber-50"
              >
                <Banknote className="w-6 h-6 text-green-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">{t('Efectivo')}</div>
                  <div className="text-sm text-gray-600">{t('Pago en efectivo')}</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedPaymentMethod('card');
                  completeOrderWithPayment();
                }}
                className="flex items-center gap-3 p-4 rounded-lg border-2 bg-white transition-colors hover:border-amber-600 hover:bg-amber-50"
              >
                <CreditCard className="w-6 h-6 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">{t('Tarjeta')}</div>
                  <div className="text-sm text-gray-600">{t('Pago con tarjeta')}</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedPaymentMethod('digital');
                  completeOrderWithPayment();
                }}
                className="flex items-center gap-3 p-4 rounded-lg border-2 bg-white transition-colors hover:border-amber-600 hover:bg-amber-50"
              >
                <Smartphone className="w-6 h-6 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">{t('Digital')}</div>
                  <div className="text-sm text-gray-600">{t('Pago digital')}</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setOrderToComplete(null);
                  setSelectedPaymentMethod('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {t('Cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Auto-Print */}
      {ticketData && (
        <div className="hidden">
          <TicketPrinter
            orderDate={ticketData.orderDate}
            orderNumber={ticketData.orderNumber}
            items={ticketData.items}
            total={ticketData.total}
            paymentMethod={ticketData.paymentMethod}
            cashierName={ticketData.cashierName}
            autoPrint={true}
            hideButton={true}
          />
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCircle, XCircle, Banknote, CreditCard, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Order {
  id: string;
  status: 'preparing' | 'completed' | 'cancelled';
  total: number;
  payment_method: string;
  created_at: string;
  employee_id: string;
  order_number?: number;
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
    fetchOrders();
    fetchOrderHistory();
    fetchEmployees();

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
          fetchOrders();
          fetchOrderHistory();
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
        .select(`
          *,
          employee_profiles!employee_id(
            full_name
          )
        `)
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
      if (data) {
        // Get order numbers for each history item
        const historyWithOrderNumbers = await Promise.all(
          data.map(async (history) => {
            const { data: orderData } = await supabase
              .from('orders')
              .select('order_number')
              .eq('id', history.order_id)
              .single();

            return {
              ...history,
              order_number: orderData?.order_number
            };
          })
        );
        setOrderHistory(historyWithOrderNumbers);
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

      // Si tenemos datos, busquemos la información del empleado para cada orden
      if (data) {
        const ordersWithEmployees = await Promise.all(
          data.map(async (order) => {
            if (order.employee_id) {
              const { data: employeeData } = await supabase
                .from('employee_profiles')
                .select('full_name, role')
                .eq('id', order.employee_id)
                .single();
              
              return {
                ...order,
                employee_profiles: employeeData
              };
            }
            return order;
          })
        );
        
        console.log('Órdenes con empleados:', ordersWithEmployees);
        setOrders(ordersWithEmployees as OrderWithItems[]);
      }

      if (error) {
        console.error('Error al obtener órdenes:', error);
        return;
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
      alert('Error al actualizar el estado');
      return;
    }
    fetchOrders();
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderToComplete, setOrderToComplete] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

  const completeOrderWithPayment = async () => {
    if (!orderToComplete || !selectedPaymentMethod) return;

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_method: selectedPaymentMethod
      })
      .eq('id', orderToComplete);

    if (error) {
      console.error('Error updating order:', error);
      alert('Error al completar la orden: ' + error.message);
      return;
    }

    // Print ticket automatically
    const order = orders.find(o => o.id === orderToComplete);
    if (order) {
      const ticketContent = `
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px;">
          <h2 style="text-align: center; margin-bottom: 10px;">TICKET DE COMPRA</h2>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>Orden #${order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8)}</strong>
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Fecha:</strong> ${new Date(order.created_at).toLocaleString('es-ES')}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>PRODUCTOS</strong>
          </div>

          ${order.order_items?.map(item => `
            <div style="margin-bottom: 5px;">
              ${item.quantity}x ${item.products?.name}${item.product_sizes ? ` (${item.product_sizes.size_name})` : ''}
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 5px;">
            <strong>Total: $${order.total.toFixed(2)}</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Método de Pago: ${selectedPaymentMethod === 'cash' ? 'Efectivo' : selectedPaymentMethod === 'card' ? 'Tarjeta' : 'Digital'}</strong>
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            ¡Gracias por su compra!
          </div>
        </div>
      `;

      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Ticket de Compra</title>
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
    }

    setShowPaymentModal(false);
    setOrderToComplete(null);
    setSelectedPaymentMethod('');
    fetchOrders();
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete || !user || !deletionNote.trim()) {
      toast.error('Debe ingresar una nota de eliminación');
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

      toast.success('Pedido eliminado correctamente');
      setShowDeleteModal(false);
      setOrderToDelete(null);
      setDeletionNote('');
      fetchOrders();
    } catch (error: any) {
      console.error('Error eliminando pedido:', error);
      toast.error(`Error al eliminar pedido: ${error.message}`);
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
    preparing: 'En Preparación',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };

  return (
    <div className="p-3 md:p-6">
      <div className="mb-4 md:mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Órdenes</h2>
        
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
            Órdenes Actuales
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
              Historial
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
                <label className="text-sm font-medium text-gray-700">Desde:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Hasta:</label>
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
                Filtrar
              </button>
            </div>

            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="all">Todos los usuarios</option>
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
              Mostrar últimas por orden
            </label>

            <div className="flex gap-2 items-center ml-auto">
              <div className="px-4 py-2 rounded-lg border bg-white shadow-sm">
                <span className="font-medium text-gray-700">Hoy:</span>
                <span className="font-bold text-amber-600 ml-1">${totals.day.toFixed(2)}</span>
              </div>
              <div className="px-4 py-2 rounded-lg border bg-white shadow-sm">
                <span className="font-medium text-gray-700">Semana:</span>
                <span className="font-bold text-amber-600 ml-1">${totals.week.toFixed(2)}</span>
              </div>
              <div className="px-4 py-2 rounded-lg border bg-white shadow-sm">
                <span className="font-medium text-gray-700">Mes:</span>
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
              <option value="all">Todos</option>
              <option value="open">Aperturas</option>
              <option value="close">Cierres</option>
            </select>
            <select
              value={selectedCashUserId}
              onChange={(e) => setSelectedCashUserId(e.target.value)}
              className="px-4 py-2 rounded-lg border"
            >
              <option value="all">Todos los usuarios</option>
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
                {range === 'today' && 'Hoy'}
                {range === 'week' && 'Esta Semana'}
                {range === 'month' && 'Este Mes'}
                {range === 'all' && 'Todo'}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'current' ? (
        filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay órdenes para mostrar</p>
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
                    Empleado: {order.employee_profiles?.full_name || profile?.full_name || (user?.email ?? 'N/A')}
                  </p>

                  {order.status === 'preparing' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="flex-1 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        Completar
                      </button>
                      <button
                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Cancelar
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
                      Eliminar Pedido
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
            <p className="text-gray-500 text-lg">No hay historial de órdenes para mostrar</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orden
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Empleado
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
                        {history.action === 'created' && 'Creada'}
                        {history.action === 'updated' && 'Actualizada'}
                        {history.action === 'completed' && 'Completada'}
                        {history.action === 'cancelled' && 'Cancelada'}
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
            <p className="text-gray-500 text-lg">No hay eventos de caja para mostrar</p>
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
                        {event.type === 'open' ? 'Apertura de caja' : 'Cierre de caja'}
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
                    <span className="font-medium">Empleado:</span> {event.employee_name}
                  </p>
                  {event.note && (
                    <p className="text-xs text-gray-600 mt-2">
                      Nota: {event.note}
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Eliminar Pedido</h2>
            <p className="text-sm text-gray-600 mb-4">
              ¿Está seguro de eliminar el pedido #{orderToDelete.order_number?.toString().padStart(3, '0') || orderToDelete.id.slice(-8)}?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Detalles del pedido:</p>
              <div className="space-y-1 text-sm text-gray-700">
                {orderToDelete.order_items.map((item, idx) => (
                  <div key={idx}>
                    {item.quantity}x {item.products?.name}
                    {item.product_sizes && ` (${item.product_sizes.size_name})`}
                  </div>
                ))}
                <div className="font-bold text-amber-600 pt-2 border-t border-amber-300">
                  Total: ${orderToDelete.total.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nota de eliminación *
              </label>
              <textarea
                value={deletionNote}
                onChange={(e) => setDeletionNote(e.target.value)}
                placeholder="Ingrese la razón de la eliminación..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {deletionNote.length}/500 caracteres
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
                Cancelar
              </button>
              <button
                onClick={handleDeleteOrder}
                disabled={deleteLoading || !deletionNote.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Eliminar Pedido
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Método de Pago</h2>

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
                  <div className="font-medium text-gray-900">Efectivo</div>
                  <div className="text-sm text-gray-600">Pago en efectivo</div>
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
                  <div className="font-medium text-gray-900">Tarjeta</div>
                  <div className="text-sm text-gray-600">Pago con tarjeta</div>
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
                  <div className="font-medium text-gray-900">Digital</div>
                  <div className="text-sm text-gray-600">Pago digital</div>
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
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
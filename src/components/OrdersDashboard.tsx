import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface Order {
  id: string;
  status: 'preparing' | 'completed' | 'cancelled';
  total: number;
  payment_method: string;
  created_at: string;
  employee_id: string;
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
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'current' | 'history' | 'cash'>('current');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [employees, setEmployees] = useState<{id:string; full_name:string}[]>([]);
  const [showLatestOnly, setShowLatestOnly] = useState<boolean>(true);
  const [cashEvents, setCashEvents] = useState<CashEvent[]>([]);
  const [selectedCashType, setSelectedCashType] = useState<'all' | 'open' | 'close'>('all');
  const [selectedCashUserId, setSelectedCashUserId] = useState<string>('all');
  const [selectedCashDateRange, setSelectedCashDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

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
  }, [selectedDateRange, viewMode]);

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

      // Aplicar filtro de fecha
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      if (selectedDateRange === 'today') {
        query = query.gte('created_at', startOfDay);
      } else if (selectedDateRange === 'week') {
        query = query.gte('created_at', startOfWeek);
      } else if (selectedDateRange === 'month') {
        query = query.gte('created_at', startOfMonth);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) {
        setOrderHistory(data);
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

  const filteredOrders = selectedStatus === 'all'
    ? orders
    : orders.filter(o => o.status === selectedStatus);

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
    <div className="p-6">
      <div className="mb-6">
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
          {profile?.role === 'admin' && (
            <button
              onClick={() => setViewMode('cash')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'cash'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Caja
            </button>
          )}
        </div>

        {viewMode === 'current' ? (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Todas
            </button>
            {Object.entries(statusLabels).map(([status, label]) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
          <div className="flex gap-2 flex-wrap">
            {['today', 'week', 'month', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => {
                  setSelectedDateRange(range as any);
                  fetchOrderHistory();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedDateRange === range
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
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-4 py-2 rounded-lg border"
            >
              <option value="all">Todos los usuarios</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            <button
              onClick={printReport}
              className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
            >
              Imprimir resultados
            </button>
            <label className="flex items-center gap-2 text-sm ml-auto">
              <input
                type="checkbox"
                checked={showLatestOnly}
                onChange={(e) => setShowLatestOnly(e.target.checked)}
              />
              Mostrar últimas por orden
            </label>
            <div className="flex gap-2 items-center w-full mt-2">
              <div className="px-3 py-2 rounded-lg border bg-white">
                <span className="font-medium">Hoy:</span> ${totals.day.toFixed(2)}
              </div>
              <div className="px-3 py-2 rounded-lg border bg-white">
                <span className="font-medium">Semana:</span> ${totals.week.toFixed(2)}
              </div>
              <div className="px-3 py-2 rounded-lg border bg-white">
                <span className="font-medium">Mes:</span> ${totals.month.toFixed(2)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyToRender.map(history => (
              <div
                key={history.id}
                className="bg-white rounded-xl shadow-sm border-2 p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(history.status)}
                      <span className="font-semibold">
                        Orden #{history.order_id}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(history.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">
                      ${history.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm">
                    <span className="font-medium">Acción:</span>{' '}
                    {history.action === 'created' && 'Creada'}
                    {history.action === 'updated' && 'Actualizada'}
                    {history.action === 'completed' && 'Completada'}
                    {history.action === 'cancelled' && 'Cancelada'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Estado:</span>{' '}
                    {statusLabels[history.status as keyof typeof statusLabels]}
                  </p>
                  {history.employee_profiles && (
                    <p className="text-xs text-gray-600 mt-2">
                      Empleado: {history.employee_profiles.full_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
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
    </div>
  );
}
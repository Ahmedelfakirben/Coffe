import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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

export function OrdersDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    fetchOrders();
    fetchOrderHistory();

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
  }, [selectedDateRange]);

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
      
      const { data, error } = await supabase
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
        .order('created_at', { ascending: false })
        .limit(50);

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

      if (data) {
        console.log('Órdenes obtenidas:', {
          cantidad: data.length,
          primera: data[0],
          última: data[data.length - 1]
        });
        setOrders(data as OrderWithItems[]);
      } else {
        console.log('No se encontraron órdenes');
      }
    } catch (err) {
      console.error('Error en fetchOrders:', err);
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
        ) : (
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
                    Empleado: {order.employee_profiles?.full_name || 'N/A'}
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
      ) : (
        orderHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay historial de órdenes para mostrar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderHistory.map(history => (
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
      )}
    </div>
  );
}
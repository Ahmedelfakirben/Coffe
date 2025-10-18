import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { CreditCard, Banknote, Smartphone } from 'lucide-react';
import { TicketPrinter } from './TicketPrinter';

type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

interface Table {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
}

export function Sala({ onGoToPOS }: { onGoToPOS?: () => void }) {
  const { user } = useAuth();
  const { tableId, setTableId, setServiceType, setActiveOrderId } = useCart();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersForTable, setOrdersForTable] = useState<Array<{id:string; total:number; payment_method:string; status:string; created_at:string; order_number:number; table_id:string}>>([]);
  const [selectedTableName, setSelectedTableName] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [showPaymentSelector, setShowPaymentSelector] = useState<string | null>(null);
  const [ticket, setTicket] = useState<{
    orderDate: Date;
    orderNumber: string;
    items: Array<{ name: string; size?: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    cashierName: string;
  } | null>(null);

  useEffect(() => {
    fetchTables();
    const channel = supabase
      .channel('tables-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        fetchTables
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name');
      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      console.error('Error al cargar mesas:', err);
      setError('No se pudieron cargar las mesas');
      toast.error('Error al cargar mesas');
    } finally {
      setLoading(false);
    }
  };

  const seedTables = async () => {
    try {
      const defaultTables = Array.from({ length: 6 }).map((_, i) => ({
        name: `Mesa ${i + 1}`,
        seats: 4,
        status: 'available' as TableStatus,
      }));
      const { error } = await supabase
        .from('tables')
        .upsert(defaultTables, { onConflict: 'name' });
      if (error) throw error;
      toast.success('Se agregaron 6 mesas por defecto');
      fetchTables();
    } catch (err) {
      console.error('Error al agregar mesas:', err);
      toast.error('No se pudieron agregar las mesas (requiere rol admin)');
    }
  };

  const fetchOpenOrdersForTable = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id,total,payment_method,status,created_at,order_number,table_id')
        .eq('table_id', id)
        .in('status', ['preparing'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrdersForTable(data || []);
    } catch (err) {
      console.error('Error al cargar órdenes de mesa:', err);
      toast.error('No se pudieron cargar los pedidos de la mesa');
    }
  };

  const selectTable = async (table: Table) => {
    setTableId(table.id);
    setServiceType('dine_in');
    setSelectedTableName(table.name);

    // Normalizar ocupación basándose en pedidos en preparación
    try {
      const { data: preparingOrders, error } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', table.id)
        .eq('status', 'preparing');
      if (error) throw error;
      const isOccupied = !!(preparingOrders && preparingOrders.length > 0);

      if (isOccupied) {
        await fetchOpenOrdersForTable(table.id);
        setShowOrdersModal(true);
      } else {
        // Si la mesa quedó marcada como ocupada sin pedidos, devolverla a disponible
        if (table.status !== 'available') {
          try {
            await supabase
              .from('tables')
              .update({ status: 'available' })
              .eq('id', table.id);
          } catch (err) {
            console.error('No se pudo normalizar estado de mesa:', err);
          }
        }
        setActiveOrderId(null);
        toast.success('Mesa seleccionada para la orden');
        // Always redirect to POS when selecting a table
        onGoToPOS?.();
      }
    } catch (err) {
      console.error('Error verificando pedidos de la mesa:', err);
      toast.error('No se pudo verificar el estado de la mesa');
    }
  };

  // Refrescar el estado de la mesa según si quedan pedidos en preparación
  const refreshTableStatusBasedOnOrders = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', id)
        .eq('status', 'preparing');
      if (error) throw error;
      const isOccupied = !!(data && data.length > 0);
      const { error: tableErr } = await supabase
        .from('tables')
        .update({ status: isOccupied ? 'occupied' : 'available' })
        .eq('id', id);
      if (tableErr) throw tableErr;
    } catch (err) {
      console.error('Error refrescando estado de mesa:', err);
    }
  };

  // Validar un pedido desde Sala: pasa de 'preparing' a 'completed' y libera mesa si corresponde
  const validateOrderFromSala = async (orderId: string, paymentMethod: 'cash' | 'card' | 'digital') => {
    if (!tableId || !user) {
      toast.error('Seleccione una mesa primero');
      return;
    }
    try {
      // Obtener detalles de la orden y sus items antes de completarla
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          order_number,
          created_at,
          order_items (
            quantity,
            unit_price,
            products (name),
            product_sizes (size_name)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Actualizar el estado de la orden
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_method: paymentMethod
        })
        .eq('id', orderId)
        .eq('status', 'preparing');
      if (error) throw error;

      // Preparar datos del ticket
      const ticketItems = orderData.order_items.map((item: any) => ({
        name: item.products.name,
        size: item.product_sizes?.size_name,
        quantity: item.quantity,
        price: item.unit_price,
      }));

      setTicket({
        orderDate: new Date(orderData.created_at),
        orderNumber: orderData.order_number ? orderData.order_number.toString().padStart(3, '0') : orderId.slice(-8),
        items: ticketItems,
        total: typeof orderData.total === 'string' ? parseFloat(orderData.total) : orderData.total,
        paymentMethod: paymentMethod,
        cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
      });

      // Clear ticket after a short delay to prevent duplicate printing
      setTimeout(() => setTicket(null), 1000);

      // Liberar la mesa completamente después de completar el pedido
      await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', tableId);

      toast.success('Pedido validado correctamente');
      setShowOrdersModal(false);
      setShowPaymentSelector(null);
      setActiveOrderId(null);
      await fetchTables();
    } catch (err) {
      console.error('Error validando pedido desde Sala:', err);
      toast.error('No se pudo validar el pedido');
    }
  };

  const clearSelection = () => {
    setTableId(null);
    setServiceType('takeaway');
    toast('Orden marcada como para llevar');
  };

  const statusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return 'border-green-200 bg-green-50 text-green-700';
      case 'occupied':
        return 'border-yellow-200 bg-yellow-50 text-yellow-700';
      case 'reserved':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'dirty':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">Cargando mesas...</div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-red-600">{error}</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Sala</h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={clearSelection}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Para llevar
          </button>
          {tableId && (
            <span className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg">Mesa seleccionada: {tables.find(t => t.id === tableId)?.name}</span>
          )}
          {tables.length === 0 && (
            <button
              onClick={seedTables}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Añadir 6 mesas
            </button>
          )}
        </div>
      </div>

      {/* Plano de la sala con mesas objetuales */}
      <div
        className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 min-h-[60vh] shadow-inner relative overflow-hidden"
        style={{
          backgroundImage: `url('/src/assets/image/sala.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay para mantener legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 to-orange-50/80 rounded-2xl"></div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 place-items-center relative z-10">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => selectTable(table)}
              className={`relative w-36 h-36 rounded-2xl border-4 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl flex flex-col items-center justify-center ${statusColor(table.status)} ${tableId === table.id ? 'ring-4 ring-amber-500 ring-offset-2' : ''}`}
              title={`${table.name} • ${table.seats} sillas • ${table.status}`}
            >
              {/* Mesa circular con patas */}
              <div className="relative">
                <div className="w-20 h-16 bg-amber-800 rounded-t-full shadow-md"></div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-4 bg-amber-900 rounded-b-lg"></div>
                {/* Patas de la mesa */}
                <div className="absolute -bottom-2 left-2 w-1 h-3 bg-amber-900 rounded"></div>
                <div className="absolute -bottom-2 right-2 w-1 h-3 bg-amber-900 rounded"></div>
              </div>

              {/* Información de la mesa */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-white/20">
                <div className="text-sm font-bold text-gray-800">{table.name}</div>
                <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                  <span>👥</span>
                  {table.seats} personas
                </div>
              </div>

              {/* Indicadores de estado visual */}
              <div className="absolute top-2 right-2">
                {table.status === 'occupied' && <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-sm"></div>}
                {table.status === 'available' && <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>}
              </div>
            </button>
          ))}
        </div>

        {/* Leyenda mejorada */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 relative z-10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm border border-green-200 shadow-sm">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-green-700">Disponible</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm border border-yellow-200 shadow-sm">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-yellow-700">Ocupada</span>
          </div>
        </div>
      </div>
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Pedidos en {selectedTableName}</h3>
            {ordersForTable.length === 0 ? (
              <p className="text-sm text-gray-600 mb-4">No hay pedidos en preparación para esta mesa.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {ordersForTable.map(order => (
                  <div key={order.id} className="border rounded-lg p-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Pedido #{order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(0,8)}</p>
                      <p className="text-xs text-gray-600">Total: ${order.total?.toFixed?.(2) ?? Number(order.total).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs"
                        onClick={() => {
                          setActiveOrderId(order.id);
                          setShowOrdersModal(false);
                          toast.success('Continuando pedido existente');
                          onGoToPOS?.();
                        }}
                      >
                        Continuar
                      </button>
                      <button
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
                        onClick={() => setShowPaymentSelector(order.id)}
                      >
                        Validar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selector de método de pago */}
            {showPaymentSelector && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Método de Pago</h4>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    onClick={() => setSelectedPaymentMethod('cash')}
                    className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                      selectedPaymentMethod === 'cash'
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Banknote className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-xs">Efectivo</span>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                      selectedPaymentMethod === 'card'
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-xs">Tarjeta</span>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('digital')}
                    className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                      selectedPaymentMethod === 'digital'
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-xs">Digital</span>
                  </button>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs"
                    onClick={() => setShowPaymentSelector(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
                    onClick={() => validateOrderFromSala(showPaymentSelector, selectedPaymentMethod)}
                  >
                    Confirmar Validación
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                onClick={() => {
                  setShowOrdersModal(false);
                  setShowPaymentSelector(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Printer para impresión automática */}
      {ticket && (
        <div className="fixed bottom-4 right-4 z-50">
          <TicketPrinter
            orderDate={ticket.orderDate}
            orderNumber={ticket.orderNumber}
            items={ticket.items}
            total={ticket.total}
            paymentMethod={ticket.paymentMethod}
            cashierName={ticket.cashierName}
            autoPrint={true}
            hideButton={true}
          />
        </div>
      )}
    </div>
  );
}
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
  const [ordersForTable, setOrdersForTable] = useState<Array<{id:string; total:number; payment_method:string; status:string; created_at:string}>>([]);
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
        .select('id,total,payment_method,status,created_at')
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
        orderNumber: orderId,
        items: ticketItems,
        total: typeof orderData.total === 'string' ? parseFloat(orderData.total) : orderData.total,
        paymentMethod: paymentMethod,
        cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
      });

      await refreshTableStatusBasedOnOrders(tableId);
      toast.success('Pedido validado correctamente');
      setShowOrdersModal(false);
      setShowPaymentSelector(null);
      setActiveOrderId(null);
      await fetchOpenOrdersForTable(tableId);
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
    <div className="p-4">
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
      <div className="bg-gray-100 border rounded-xl p-6 min-h-[60vh]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 place-items-center">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => selectTable(table)}
              className={`relative w-32 h-32 rounded-full border-4 shadow-sm transition-transform hover:scale-105 flex items-center justify-center ${statusColor(table.status)} ${tableId === table.id ? 'ring-4 ring-amber-500' : ''}`}
              title={`${table.name} • ${table.seats} sillas • ${table.status}`}
            >
              <div className="text-center">
                <div className="text-sm font-bold">{table.name}</div>
                <div className="text-xs">{table.seats} sillas</div>
              </div>
              {/* Indicadores de asientos simples */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {Array.from({ length: Math.min(table.seats, 6) }).map((_, i) => (
                  <span key={i} className="w-3 h-3 rounded-full bg-gray-300 border border-white"></span>
                ))}
              </div>
            </button>
          ))}
        </div>
        {/* Leyenda de estados */}
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <span className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">Disponible</span>
          <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">Ocupada</span>
          <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">Reservada</span>
          <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">Sucio</span>
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
                      <p className="text-sm font-semibold">Pedido #{order.id.slice(0,8)}</p>
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
              <button
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm"
                onClick={() => {
                  setShowOrdersModal(false);
                  setShowPaymentSelector(null);
                  toast.success('Mesa seleccionada para nueva orden');
                  onGoToPOS?.();
                }}
              >
                Confirmar nuevo pedido
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
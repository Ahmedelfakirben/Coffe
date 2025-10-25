import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'react-hot-toast';
import { CreditCard, Banknote, Smartphone } from 'lucide-react';
import { TicketPrinter } from './TicketPrinter';
import { useLanguage } from '../contexts/LanguageContext';
import salaBackgroundImage from '../assets/image/sala.png';

type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

interface Table {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
}

export function Sala({ onGoToPOS }: { onGoToPOS?: () => void }) {
  const { user, profile } = useAuth();
  const { tableId, setTableId, setServiceType, setActiveOrderId } = useCart();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
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

  // Limpiar ticket después de imprimir
  useEffect(() => {
    if (ticket) {
      console.log('🎫 SALA: Ticket establecido, esperando impresión...', new Date().toISOString());

      let cleaned = false;

      // Escuchar evento de impresión completada
      const handleTicketPrinted = () => {
        if (!cleaned) {
          console.log('🎫 SALA: Evento ticketPrinted recibido, limpiando ticket', new Date().toISOString());
          cleaned = true;
          setTicket(null);
        }
      };

      // Timeout de fallback de 10 segundos por si el evento no se dispara
      const timer = setTimeout(() => {
        if (!cleaned) {
          console.log('🎫 SALA: Timeout alcanzado, limpiando ticket (fallback)', new Date().toISOString());
          cleaned = true;
          setTicket(null);
        }
      }, 10000);

      window.addEventListener('ticketPrinted', handleTicketPrinted);

      return () => {
        console.log('🎫 SALA: Cleanup - removiendo listener y timer');
        window.removeEventListener('ticketPrinted', handleTicketPrinted);
        clearTimeout(timer);
      };
    }
  }, [ticket]);

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
      setError(t('No se pudieron cargar las mesas'));
      toast.error(t('Error al cargar mesas'));
    } finally {
      setLoading(false);
    }
  };

  const seedTables = async () => {
    try {
      const defaultTables = Array.from({ length: 6 }).map((_, i) => ({
        name: `${t('Mesa')} ${i + 1}`,
        seats: 4,
        status: 'available' as TableStatus,
      }));
      const { error } = await supabase
        .from('tables')
        .upsert(defaultTables, { onConflict: 'name' });
      if (error) throw error;
      toast.success(t('Se agregaron 6 mesas por defecto'));
      fetchTables();
    } catch (err) {
      console.error('Error al agregar mesas:', err);
      toast.error(t('No se pudieron agregar las mesas (requiere rol admin)'));
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
      toast.error(t('No se pudieron cargar los pedidos de la mesa'));
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
        toast.success(t('Mesa seleccionada para la orden'));
        // Always redirect to POS when selecting a table
        onGoToPOS?.();
      }
    } catch (err) {
      console.error('Error verificando pedidos de la mesa:', err);
      toast.error(t('No se pudo verificar el estado de la mesa'));
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
      toast.error(t('Seleccione una mesa primero'));
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

      // Formatear método de pago
      const paymentMethodText = paymentMethod === 'cash' ? t('Efectivo') :
                                paymentMethod === 'card' ? t('Tarjeta') : t('Digital');

      console.log('🎫 SALA: Preparando ticket con datos:', {
        orderNumber: orderData.order_number,
        items: ticketItems.length,
        total: orderData.total,
        paymentMethod: paymentMethodText
      });

      const ticketDataToSet = {
        orderDate: new Date(orderData.created_at),
        orderNumber: orderData.order_number ? orderData.order_number.toString().padStart(3, '0') : orderId.slice(-8),
        items: ticketItems,
        total: typeof orderData.total === 'string' ? parseFloat(orderData.total) : orderData.total,
        paymentMethod: paymentMethodText,
        cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
      };

      console.log('🎫 SALA: Estableciendo ticket para impresión');
      setTicket(ticketDataToSet);

      // Liberar la mesa completamente después de completar el pedido
      await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', tableId);

      toast.success(t('Pedido validado correctamente'));
      setShowOrdersModal(false);
      setShowPaymentSelector(null);
      setActiveOrderId(null);
      await fetchTables();
    } catch (err) {
      console.error('Error validando pedido desde Sala:', err);
      toast.error(t('No se pudo validar el pedido'));
    }
  };

  const clearSelection = () => {
    setTableId(null);
    setServiceType('takeaway');
    toast(t('Orden marcada como para llevar'));
  };

  const statusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-100 text-green-800 shadow-lg shadow-green-500/20';
      case 'occupied':
        return 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 text-amber-800 shadow-lg shadow-amber-500/30';
      case 'reserved':
        return 'border-blue-300 bg-gradient-to-br from-blue-50 to-sky-100 text-blue-800 shadow-lg shadow-blue-500/20';
      case 'dirty':
        return 'border-red-300 bg-gradient-to-br from-red-50 to-rose-100 text-red-800 shadow-lg shadow-red-500/20';
      default:
        return 'border-gray-200 bg-gray-50 shadow-md';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">{t('Cargando mesas...')}</div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-red-600">{error}</div>
    );
  }

  // Vista móvil
  const renderMobileView = () => (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: `url(${salaBackgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay para mantener legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/20 to-white/30"></div>

      {/* Contenido sobre la imagen */}
      <div className="relative z-10">
        {/* Header móvil */}
        <div className="bg-white/95 backdrop-blur-md p-6 border-b border-amber-200/50 sticky top-0 z-10 shadow-lg">
          <h2 className="text-3xl font-black bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 bg-clip-text text-transparent">{t('Gestión de Sala')}</h2>
          {tableId && (
            <p className="text-sm font-semibold text-amber-600 mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              {t('Mesa seleccionada:')}{' '}{tables.find(t => t.id === tableId)?.name}
            </p>
          )}
        </div>

        {/* Botones de acción */}
        <div className="p-4 bg-gradient-to-r from-white/90 via-white/80 to-white/90 backdrop-blur-md border-b border-amber-200/50 flex gap-3">
        <button
          onClick={clearSelection}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          {t('Para llevar')}
        </button>
        {tables.length === 0 && (
          <button
            onClick={seedTables}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300 hover:scale-105"
          >
            {t('Añadir 6 mesas')}
          </button>
        )}
      </div>

      {/* Lista de mesas móvil */}
      <div className="p-6 space-y-4">
        {tables.length === 0 ? (
          <div className="text-center py-16 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl">
            <p className="text-gray-600 text-lg font-medium">{t('No hay mesas configuradas')}</p>
          </div>
        ) : (
          tables.map((table) => (
            <button
              key={table.id}
              onClick={() => selectTable(table)}
              className={`w-full rounded-2xl border-3 p-5 text-left transition-all duration-300 hover:scale-102 ${
                statusColor(table.status)
              } ${
                tableId === table.id ? 'ring-4 ring-amber-500 ring-offset-2 scale-105' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-5 h-5 rounded-full shadow-lg ${
                    table.status === 'occupied' ? 'bg-amber-500 animate-pulse shadow-amber-500/50' :
                    table.status === 'available' ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-400'
                  }`}></div>
                  <div>
                    <h3 className="font-black text-gray-900 text-xl">{table.name}</h3>
                    <p className="text-sm font-semibold text-gray-700 mt-1">
                      👥 {table.seats} {t('personas')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-4 py-2 rounded-xl text-xs font-bold shadow-md ${
                    table.status === 'available' ? 'bg-green-200 text-green-800' :
                    table.status === 'occupied' ? 'bg-amber-200 text-amber-800' :
                    table.status === 'reserved' ? 'bg-blue-200 text-blue-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {table.status === 'available' ? t('Disponible') :
                     table.status === 'occupied' ? t('Ocupada') :
                     table.status === 'reserved' ? t('Reservada') : t('Sucia')}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Leyenda móvil */}
      <div className="p-5 bg-white/95 backdrop-blur-lg border-t-2 border-amber-300/50 fixed bottom-0 left-0 right-0 z-10 shadow-2xl">
        <div className="flex justify-around text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <span className="text-gray-800 font-semibold">{t('Disponible')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50"></div>
            <span className="text-gray-800 font-semibold">{t('Ocupada')}</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Vista Móvil */}
      <div className="md:hidden">
        {renderMobileView()}
      </div>

      {/* Vista Desktop */}
      <div
        className="hidden md:block min-h-screen relative overflow-hidden"
        style={{
          backgroundImage: `url(${salaBackgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Overlay para mantener legibilidad en toda la página */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/20 to-white/30"></div>

        {/* Contenido sobre la imagen */}
        <div className="relative z-10 p-8">
          <div className="flex flex-col items-center mb-8">
            <h2 className="text-5xl font-black bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 bg-clip-text text-transparent drop-shadow-lg mb-6 text-center">{t('Sala')}</h2>
            <div className="flex gap-3 items-center justify-center">
              <button
                onClick={clearSelection}
                className="px-6 py-3 bg-white/95 hover:bg-white backdrop-blur-md rounded-xl shadow-xl border-2 border-gray-200 hover:border-gray-300 font-bold transition-all duration-300 hover:scale-105"
              >
                {t('Para llevar')}
              </button>
              {tableId && (
                <span className="px-6 py-3 bg-gradient-to-r from-amber-100 to-orange-100 backdrop-blur-md text-amber-800 font-bold rounded-xl shadow-xl border-2 border-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  {t('Mesa seleccionada:')}{' '}{tables.find(t => t.id === tableId)?.name}
                </span>
              )}
              {tables.length === 0 && (
                <button
                  onClick={seedTables}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 transition-all duration-300 hover:scale-105"
                >
                  {t('Añadir 6 mesas')}
                </button>
              )}
            </div>
          </div>

          {/* Plano de la sala con mesas objetuales */}
          <div className="border-4 border-white/40 rounded-3xl p-10 min-h-[calc(100vh-12rem)] shadow-2xl bg-white/10 backdrop-blur-sm relative overflow-hidden">

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 place-items-center relative z-10">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => selectTable(table)}
              className={`relative w-40 h-40 rounded-3xl border-4 shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-3xl flex flex-col items-center justify-center ${statusColor(table.status)} ${tableId === table.id ? 'ring-4 ring-amber-500 ring-offset-4 scale-105' : ''}`}
              title={`${table.name} • ${table.seats} sillas • ${table.status}`}
            >
              {/* Mesa circular con patas mejorada */}
              <div className="relative">
                <div className="w-24 h-20 bg-gradient-to-br from-amber-800 to-amber-900 rounded-t-full shadow-2xl"></div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-20 h-5 bg-gradient-to-b from-amber-900 to-amber-950 rounded-b-lg shadow-lg"></div>
                {/* Patas de la mesa con sombra */}
                <div className="absolute -bottom-3 left-3 w-1.5 h-4 bg-amber-950 rounded shadow-md"></div>
                <div className="absolute -bottom-3 right-3 w-1.5 h-4 bg-amber-950 rounded shadow-md"></div>
              </div>

              {/* Información de la mesa con mejor diseño */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center bg-white/95 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-2xl border-2 border-white/40">
                <div className="text-sm font-black text-gray-900">{table.name}</div>
                <div className="text-xs font-bold text-gray-700 flex items-center justify-center gap-1 mt-1">
                  <span>👥</span>
                  {table.seats} {t('personas')}
                </div>
              </div>

              {/* Indicadores de estado visual mejorados */}
              <div className="absolute top-3 right-3">
                {table.status === 'occupied' && <div className="w-4 h-4 bg-amber-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50"></div>}
                {table.status === 'available' && <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>}
              </div>
            </button>
          ))}
        </div>

        {/* Leyenda mejorada */}
        <div className="mt-10 flex flex-wrap justify-center gap-5 relative z-10">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/95 backdrop-blur-md border-2 border-green-300 shadow-xl">
            <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <span className="text-sm font-bold text-green-800">{t('Disponible')}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/95 backdrop-blur-md border-2 border-amber-300 shadow-xl">
            <div className="w-4 h-4 bg-amber-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50"></div>
            <span className="text-sm font-bold text-amber-800">{t('Ocupada')}</span>
          </div>
        </div>
      </div>
        </div>

      {showOrdersModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
            <h3 className="text-2xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-6">{t('Pedidos en')} {selectedTableName}</h3>
            {ordersForTable.length === 0 ? (
              <p className="text-base text-gray-600 mb-6 font-medium">{t('No hay pedidos en preparación para esta mesa.')}</p>
            ) : (
              <div className="space-y-3 mb-6">
                {ordersForTable.map(order => (
                  <div key={order.id} className="border-2 border-gray-200 rounded-2xl p-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white shadow-md hover:shadow-lg transition-all">
                    <div>
                      <p className="text-base font-black text-gray-900">{t('Pedido')} #{order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(0,8)}</p>
                      <p className="text-sm font-bold text-amber-600 mt-1">{t('Total:')} {formatCurrency(order.total)}</p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/30 hover:shadow-xl transition-all duration-300 hover:scale-105"
                        onClick={() => {
                          setActiveOrderId(order.id);
                          setShowOrdersModal(false);
                          toast.success(t('Continuando pedido existente'));
                          onGoToPOS?.();
                        }}
                      >
                        {t('Continuar')}
                      </button>
                      {profile?.role !== 'waiter' && (
                        <button
                          className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-500/30 hover:shadow-xl transition-all duration-300 hover:scale-105"
                          onClick={() => setShowPaymentSelector(order.id)}
                        >
                          {t('Validar')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selector de método de pago */}
            {showPaymentSelector && (
              <div className="mt-6 p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200">
                <h4 className="text-lg font-black text-gray-900 mb-4">{t('Método de Pago')}</h4>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <button
                    onClick={() => setSelectedPaymentMethod('cash')}
                    className={`p-4 rounded-xl border-3 bg-white transition-all duration-300 hover:scale-105 ${
                      selectedPaymentMethod === 'cash'
                        ? 'border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg shadow-amber-500/30'
                        : 'border-gray-200 hover:border-gray-300 shadow-md'
                    }`}
                  >
                    <Banknote className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-bold">{t('Efectivo')}</span>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-4 rounded-xl border-3 bg-white transition-all duration-300 hover:scale-105 ${
                      selectedPaymentMethod === 'card'
                        ? 'border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg shadow-amber-500/30'
                        : 'border-gray-200 hover:border-gray-300 shadow-md'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-bold">{t('Tarjeta')}</span>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('digital')}
                    className={`p-4 rounded-xl border-3 bg-white transition-all duration-300 hover:scale-105 ${
                      selectedPaymentMethod === 'digital'
                        ? 'border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg shadow-amber-500/30'
                        : 'border-gray-200 hover:border-gray-300 shadow-md'
                    }`}
                  >
                    <Smartphone className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-bold">{t('Digital')}</span>
                  </button>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    className="px-5 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
                    onClick={() => setShowPaymentSelector(null)}
                  >
                    {t('Cancelar')}
                  </button>
                  <button
                    className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-500/30 hover:shadow-xl transition-all duration-300 hover:scale-105"
                    onClick={() => validateOrderFromSala(showPaymentSelector, selectedPaymentMethod)}
                  >
                    {t('Confirmar Validación')}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
                onClick={() => {
                  setShowOrdersModal(false);
                  setShowPaymentSelector(null);
                }}
              >
                {t('Cerrar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Auto-Print */}
      {ticket && (
        <>
          {console.log('🎫 SALA: Renderizando TicketPrinter con datos:', ticket)}
          <div className="hidden">
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
        </>
      )}
      </div>
    </>
  );
}
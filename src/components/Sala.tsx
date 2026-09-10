import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'react-hot-toast';
import {
  CreditCard, Banknote, Smartphone, Plus, X,
  Users, Clock, ShoppingBag, RefreshCw, Menu,
} from 'lucide-react';
import { TicketPrinter } from './TicketPrinter';
import { useLanguage } from '../contexts/LanguageContext';

type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

interface Table {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  shape: string;
  zone_id: string;
}

interface ActiveOrder {
  id: string;
  total: number | string;
  created_at: string;
  table_id: string;
  order_number?: string | number;
}

interface TicketData {
  orderDate: Date;
  orderNumber: string;
  items: Array<{ name: string; size?: string; quantity: number; price: number }>;
  total: number;
  paymentMethod: string;
  cashierName: string;
}

// ── Timer inteligente ─────────────────────────────────────────────────────────
function TableTimer({ createdAt }: { createdAt: string }) {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    const calc = () => {
      const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
      if (mins < 60)        setDisplay(`${mins}m`);
      else if (mins < 1440) setDisplay(`${Math.floor(mins / 60)}h ${mins % 60}m`);
      else                  setDisplay(`${Math.floor(mins / 1440)}d`);
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [createdAt]);
  return (
    <span className="flex items-center gap-1 text-xs opacity-80">
      <Clock className="w-3 h-3" /> {display}
    </span>
  );
}

// ── Colores / estilos por estado ──────────────────────────────────────────────
const STATUS_STYLE: Record<TableStatus, { card: string; badge: string; labelKey: string }> = {
  available: {
    card:  'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400/50 shadow-emerald-500/30',
    badge: 'bg-emerald-700/50 text-emerald-100',
    labelKey: 'Disponible',
  },
  occupied: {
    card:  'bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400/50 shadow-amber-500/30',
    badge: 'bg-amber-700/50 text-amber-100',
    labelKey: 'Ocupada',
  },
  reserved: {
    card:  'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400/50 shadow-blue-500/30',
    badge: 'bg-blue-700/50 text-blue-100',
    labelKey: 'Reservada',
  },
  dirty: {
    card:  'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400/50 shadow-rose-500/30',
    badge: 'bg-rose-700/50 text-rose-100',
    labelKey: 'Sucia',
  },
};

// ═════════════════════════════════════════════════════════════════════════════
export function Sala({ onGoToPOS }: { onGoToPOS?: () => void }) {
  const { user, profile } = useAuth();
  const { tableId, setTableId, setServiceType, setActiveOrderId } = useCart();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();

  const [tables, setTables]             = useState<Table[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeOrders, setActiveOrders] = useState<Record<string, ActiveOrder[]>>({});

  // Modales
  const [activeTableAction, setActiveTableAction]         = useState<Table | null>(null);
  const [showOrdersModal, setShowOrdersModal]             = useState(false);
  const [ordersForTable, setOrdersForTable]               = useState<ActiveOrder[]>([]);
  const [selectedTableName, setSelectedTableName]         = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [showPaymentSelector, setShowPaymentSelector]     = useState<string | null>(null);

  const [ticket, setTicket] = useState<TicketData | null>(null);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTables();
    fetchActiveOrders();
    const ch1 = supabase.channel('sala-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables)
      .subscribe();
    const ch2 = supabase.channel('sala-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchActiveOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ticket) return;
    let done = false;
    const finish = () => { if (!done) { done = true; setTicket(null); } };
    const t = setTimeout(finish, 10000);
    window.addEventListener('ticketPrinted', finish);
    return () => { window.removeEventListener('ticketPrinted', finish); clearTimeout(t); };
  }, [ticket]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tables').select('*').order('name');
      if (error) throw error;
      setTables(data || []);
    } catch { toast.error(t('Error al cargar mesas')); }
    finally { setLoading(false); }
  };

  const fetchActiveOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders').select('id, total, created_at, table_id').eq('status', 'preparing');
      if (error) throw error;
      const grouped = (data || []).reduce((acc: Record<string, ActiveOrder[]>, o) => {
        if (!acc[o.table_id]) acc[o.table_id] = [];
        acc[o.table_id].push(o as ActiveOrder);
        return acc;
      }, {});
      setActiveOrders(grouped);
    } catch { /* silente */ }
  };

  // ── Acciones de mesa ─────────────────────────────────────────────────────────
  const openPOSForTable = async (table: Table) => {
    setTableId(table.id);
    setServiceType('dine_in');
    try {
      if ((activeOrders[table.id] || []).length === 0 && table.status !== 'available')
        await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);
    } catch { /* ok */ }
    setActiveOrderId(null);
    toast.success(`${table.name} ${t('Mesa seleccionada:')}`);
    onGoToPOS?.();
  };

  const openOrdersModal = async (table: Table) => {
    setActiveTableAction(null);
    setTableId(table.id);
    setServiceType('dine_in');
    setSelectedTableName(table.name);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id,total,payment_method,status,created_at,order_number,table_id')
        .eq('table_id', table.id).in('status', ['preparing'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrdersForTable(data || []);
      setShowOrdersModal(true);
    } catch { toast.error(t('Error al cargar los pedidos')); }
  };

  const validateOrder = async (orderId: string, paymentMethod: 'cash' | 'card' | 'digital') => {
    if (!tableId || !user) return;
    try {
      const { data: od, error: oe } = await supabase.from('orders')
        .select(`id, total, order_number, created_at, order_items (quantity, unit_price, products (name), product_sizes (size_name))`)
        .eq('id', orderId).single();
      if (oe) throw oe;
      await supabase.from('orders').update({ status: 'completed', payment_method: paymentMethod }).eq('id', orderId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = od.order_items.map((i: any) => ({
        name: Array.isArray(i.products) ? i.products[0]?.name : i.products?.name,
        size: Array.isArray(i.product_sizes) ? i.product_sizes[0]?.size_name : i.product_sizes?.size_name,
        quantity: i.quantity, price: i.unit_price,
      }));
      setTicket({
        orderDate: new Date(od.created_at),
        orderNumber: od.order_number ? String(od.order_number).padStart(3, '0') : orderId.slice(-8),
        items,
        total: typeof od.total === 'string' ? parseFloat(od.total) : od.total,
        paymentMethod: paymentMethod === 'cash' ? t('Efectivo') : paymentMethod === 'card' ? t('Tarjeta') : t('Digital'),
        cashierName: user.user_metadata?.full_name || user.email || 'Usuario',
      });
      if (ordersForTable.filter(o => o.id !== orderId).length === 0)
        await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
      toast.success(t('Pedido validado'));
      setShowOrdersModal(false);
      setShowPaymentSelector(null);
      setActiveOrderId(null);
      fetchTables();
      fetchActiveOrders();
    } catch { toast.error(t('No se pudo validar el pedido')); }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full w-full flex flex-col font-sans overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1a0c05 0%, #221005 60%, #1a0c05 100%)' }}
    >

      {/* ── Barra superior ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 bg-[#110802]/80 backdrop-blur-md border-b border-amber-900/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-black bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent whitespace-nowrap">
            ☕ Sala
          </h2>
          <span className="px-2 py-0.5 bg-amber-900/30 border border-amber-800/40 rounded-full text-xs font-bold text-amber-300">
            {tables.length} {t('Mesas')}
          </span>
          {/* Leyenda */}
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-amber-900/30">
            {(Object.entries(STATUS_STYLE) as [TableStatus, typeof STATUS_STYLE[TableStatus]][]).map(([key, s]) => (
              <div key={key} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${
                  key === 'available' ? 'from-emerald-400 to-emerald-600' :
                  key === 'occupied'  ? 'from-amber-400 to-orange-500' :
                  key === 'reserved'  ? 'from-blue-400 to-blue-600' :
                                        'from-rose-400 to-rose-600'
                }`} />
                <span className="text-xs text-amber-200/50">{t(s.labelKey)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { fetchTables(); fetchActiveOrders(); }}
            className="p-2 text-amber-600 hover:text-amber-300 hover:bg-amber-900/30 rounded-xl transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTableId(null); setServiceType('takeaway'); toast(t('Para llevar')); onGoToPOS?.(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-800/40 text-amber-200 rounded-xl text-xs font-bold transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Para llevar')}</span>
          </button>
        </div>
      </div>

      {/* ── Grid de mesas ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && tables.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-amber-700 text-sm">{t('Cargando mesas...')}</p>
            </div>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-5xl">🪑</div>
            <p className="text-amber-200/40 font-semibold">{t('No hay mesas configuradas')}</p>
            <p className="text-amber-700/50 text-sm">
              {t('Sistema de Gestión')} → <span className="text-amber-400">{t('nav.tables')}</span>
            </p>
          </div>
        ) : (
          /* Grid responsivo: 2 col móvil · 3 col tablet · 4 col desktop */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-w-6xl mx-auto">
            {tables.map(table => {
              const hasOrders      = (activeOrders[table.id] || []).length > 0;
              const computedStatus: TableStatus = hasOrders ? 'occupied' : table.status;
              const style          = STATUS_STYLE[computedStatus] ?? STATUS_STYLE.available;
              const totalAmount    = hasOrders
                ? activeOrders[table.id].reduce((s, o) => s + (typeof o.total === 'string' ? parseFloat(o.total) : o.total), 0)
                : 0;
              const firstDate = hasOrders
                ? activeOrders[table.id][activeOrders[table.id].length - 1].created_at
                : null;

              return (
                <button
                  key={table.id}
                  onClick={() => setActiveTableAction(table)}
                  className={`
                    relative flex flex-col items-center justify-between
                    p-4 rounded-2xl border-2 shadow-xl
                    min-h-[130px] sm:min-h-[150px]
                    transition-all duration-200 active:scale-95 hover:scale-[1.03] hover:shadow-2xl
                    select-none text-white
                    ${style.card}
                  `}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Brillo superior */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent rounded-2xl pointer-events-none" />

                  {/* Badge de pedidos */}
                  {hasOrders && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-black/40 rounded-full flex items-center justify-center z-10">
                      <span className="text-[10px] font-black">{activeOrders[table.id].length}</span>
                    </div>
                  )}

                  {/* Nombre y asientos */}
                  <div className="flex flex-col items-center gap-1 z-10 flex-1 justify-center">
                    <span className="font-black text-lg leading-tight text-center drop-shadow">
                      {table.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold opacity-75">
                      <Users className="w-3.5 h-3.5" /> {table.seats}
                    </span>
                  </div>

                  {/* Info de pedido activo */}
                  {hasOrders ? (
                    <div className="z-10 w-full bg-black/35 rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 mt-2">
                      <span className="font-black text-sm leading-tight">{formatCurrency(totalAmount)}</span>
                      {firstDate && <TableTimer createdAt={firstDate} />}
                    </div>
                  ) : (
                    <div className={`z-10 px-3 py-1 rounded-full text-xs font-bold mt-2 ${style.badge}`}>
                      {t(style.labelKey)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Acción sobre mesa
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTableAction && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sala-fade-in"
          onClick={() => setActiveTableAction(null)}
        >
          <div
            className="bg-[#120a03] border border-amber-900/40 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:w-auto sm:min-w-[300px] p-6 pb-8 sm:pb-6 sala-slide-in-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle móvil */}
            <div className="w-10 h-1 bg-amber-800/50 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="text-center mb-5">
              <h3 className="text-2xl font-black text-amber-100">{activeTableAction.name}</h3>
              <div className="mt-1.5">
                {(activeOrders[activeTableAction.id] || []).length > 0 ? (
                  <span className="text-amber-400 text-sm font-semibold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {activeOrders[activeTableAction.id].length} {activeOrders[activeTableAction.id].length === 1 ? t('Pedido') : t('Pedidos')}
                  </span>
                ) : (
                  <span className="text-emerald-400 text-sm font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {t('Disponible')}
                  </span>
                )}
              </div>
            </div>

            <div className={`grid gap-3 ${(activeOrders[activeTableAction.id] || []).length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Añadir pedido */}
              <button
                onClick={() => { setActiveTableAction(null); openPOSForTable(activeTableAction); }}
                className="flex flex-col items-center gap-3 bg-amber-900/20 hover:bg-amber-900/40 border border-amber-800/40 rounded-2xl p-5 transition-all active:scale-95 group"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 group-hover:bg-amber-500/25 flex items-center justify-center transition-colors">
                  <Plus className="w-7 h-7 text-amber-400" />
                </div>
                <span className="font-bold text-sm text-amber-200">{t('Nuevo pedido') || 'Nouveau commande'}</span>
              </button>

              {/* Ver cuenta */}
              {(activeOrders[activeTableAction.id] || []).length > 0 && (
                <button
                  onClick={() => openOrdersModal(activeTableAction)}
                  className="flex flex-col items-center gap-3 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/40 rounded-2xl p-5 transition-all active:scale-95 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 group-hover:bg-emerald-500/25 flex items-center justify-center transition-colors">
                    <CreditCard className="w-7 h-7 text-emerald-400" />
                  </div>
                  <span className="font-bold text-sm text-emerald-200">{t('Ver Cuenta') || 'Voir Compte'}</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setActiveTableAction(null)}
              className="w-full mt-4 py-2 text-amber-800/50 hover:text-amber-600 text-xs transition-colors"
            >
              {t('Cancelar')}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Pedidos / Cobro
      ══════════════════════════════════════════════════════════════════════ */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sala-fade-in">
          <div className="bg-[#120a03] border border-amber-900/40 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[90vh] flex flex-col sala-slide-in-up">
            <div className="flex-shrink-0 p-6 pb-0">
              {/* Handle */}
              <div className="w-10 h-1 bg-amber-800/50 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-amber-100">
                  {t('Pedidos en')} <span className="text-amber-400">{selectedTableName}</span>
                </h3>
                <button
                  onClick={() => { setShowOrdersModal(false); setShowPaymentSelector(null); }}
                  className="text-amber-800 hover:text-amber-300 p-1 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
              {ordersForTable.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-amber-700/60 text-sm">{t('No hay pedidos en preparación.')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ordersForTable.map(order => (
                    <div key={order.id} className="bg-amber-900/15 border border-amber-900/40 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-amber-100 text-sm">
                          #{order.order_number?.toString() || order.id.slice(0, 8)}
                        </p>
                        <p className="text-xl font-black text-amber-400 mt-0.5">
                          {formatCurrency(typeof order.total === 'string' ? parseFloat(order.total) : order.total)}
                        </p>
                        <p className="text-xs text-amber-700/60 mt-0.5">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => { setActiveOrderId(order.id); setShowOrdersModal(false); onGoToPOS?.(); }}
                          className="px-4 py-2 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800/30 text-amber-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          {t('common.edit')}
                        </button>
                        {profile?.role !== 'waiter' && (
                          <button
                            onClick={() => setShowPaymentSelector(order.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            {t('Cobrar') || 'Encaisser'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selector de pago */}
              {showPaymentSelector && (
                <div className="mt-4 p-4 bg-amber-900/15 rounded-2xl border border-amber-900/30">
                  <p className="text-sm font-bold text-amber-200 mb-3">{t('Método de Pago:')}</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['cash', 'card', 'digital'] as const).map(method => (
                      <button
                        key={method}
                        onClick={() => setSelectedPaymentMethod(method)}
                        className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all ${
                          selectedPaymentMethod === method
                            ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                            : 'border-amber-900/40 bg-amber-900/10 text-amber-600'
                        }`}
                      >
                        {method === 'cash'    && <Banknote   className="w-5 h-5" />}
                        {method === 'card'    && <CreditCard className="w-5 h-5" />}
                        {method === 'digital' && <Smartphone className="w-5 h-5" />}
                        <span className="text-xs font-bold">
                          {method === 'cash' ? t('Efectivo') : method === 'card' ? t('Tarjeta') : t('Digital')}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => validateOrder(showPaymentSelector, selectedPaymentMethod)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-base shadow-lg transition-all active:scale-95"
                  >
                    ✓ {t('Validar e Imprimir')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticket oculto para impresión */}
      {ticket && (
        <div className="hidden">
          <TicketPrinter
            orderDate={ticket.orderDate} orderNumber={ticket.orderNumber}
            items={ticket.items} total={ticket.total}
            paymentMethod={ticket.paymentMethod} cashierName={ticket.cashierName}
            autoPrint={true} hideButton={true}
          />
        </div>
      )}
    </div>
  );
}
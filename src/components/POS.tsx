import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Category, Product, ProductSize } from '../types/supabase';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { TicketPrinter } from './TicketPrinter';
import { toast } from 'react-hot-toast';

const ITEMS_PER_PAGE = 12;

export function POS() {
  const { user } = useAuth();
  const { 
    items: cart,
    total,
    paymentMethod,
    addItem,
    updateQuantity,
    removeItem,
    setPaymentMethod,
    clearCart,
    serviceType,
    tableId,
    setServiceType,
    setTableId,
    activeOrderId,
    setActiveOrderId
  } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<{id:string; name:string; seats:number; status:string}[]>([]);
  const [printAutomatically, setPrintAutomatically] = useState(false);
  const [validateDirectly, setValidateDirectly] = useState(false);
  const [existingItems, setExistingItems] = useState<Array<{ name: string; size?: string; quantity: number; price: number; subtotal: number }>>([]);
  const [existingOrderTotal, setExistingOrderTotal] = useState<number>(0);
  const [ticket, setTicket] = useState<{
    orderDate: Date;
    orderNumber: string;
    items: Array<{ name: string; size?: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    cashierName: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCategories(),
      fetchInitialProducts(),
      fetchSizes()
    ]).finally(() => setDataLoading(false));
  }, []);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name');
      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Cargar contenido de pedido activo si existe
  useEffect(() => {
    const loadActiveOrderContent = async () => {
      if (!activeOrderId) {
        setExistingItems([]);
        setExistingOrderTotal(0);
        return;
      }
      try {
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .select('id,total')
          .eq('id', activeOrderId)
          .single();
        if (orderErr) throw orderErr;
        const currentTotal = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
        setExistingOrderTotal(currentTotal);

        const { data: items, error: itemsErr } = await supabase
          .from('order_items')
          .select('quantity, unit_price, subtotal, size_id, product_id, products(name), product_sizes(size_name)')
          .eq('order_id', activeOrderId);
        if (itemsErr) throw itemsErr;
        const mapped = (items || []).map((it: any) => ({
          name: it.products?.name || 'Producto',
          size: it.product_sizes?.size_name || undefined,
          quantity: it.quantity,
          price: typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price,
          subtotal: typeof it.subtotal === 'string' ? parseFloat(it.subtotal) : it.subtotal,
        }));
        setExistingItems(mapped);
      } catch (err) {
        console.error('Error cargando contenido de pedido activo:', err);
        toast.error('No se pudo cargar el contenido del pedido activo');
      }
    };
    loadActiveOrderContent();
  }, [activeOrderId]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Error al cargar categorías');
      setError('No se pudieron cargar las categorías');
    }
  };

  const fetchInitialProducts = async () => {
    setPage(1);
    await fetchProducts(true);
  };

  const fetchProducts = async (reset = false) => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('available', true)
        .order('name');

      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      query = query
        .range((reset ? 0 : (page - 1) * ITEMS_PER_PAGE), 
               (reset ? ITEMS_PER_PAGE - 1 : page * ITEMS_PER_PAGE - 1));

      const { data, error } = await query;
      
      if (error) throw error;

      if (data) {
        setProducts(prev => reset ? data : [...prev, ...data]);
        setHasMore(data.length === ITEMS_PER_PAGE);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Error al cargar productos');
      setError('No se pudieron cargar los productos');
    }
  };

  const fetchSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('product_sizes')
        .select('*');
      
      if (error) throw error;
      setSizes(data || []);
    } catch (err) {
      console.error('Error fetching sizes:', err);
      toast.error('Error al cargar tamaños');
      setError('No se pudieron cargar los tamaños de productos');
    }
  };

  useEffect(() => {
    fetchInitialProducts();
  }, [selectedCategory]);

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchProducts();
  };

  const productSizes = (productId: string) => sizes.filter(s => s.product_id === productId);

  // Helpers para estado de mesas
  const updateTableStatus = async (id: string, status: 'available' | 'occupied') => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error actualizando estado de mesa:', err);
    }
  };

  const refreshTableStatusBasedOnOrders = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', id)
        .eq('status', 'preparing');
      if (error) throw error;
      await updateTableStatus(id, (data && data.length > 0) ? 'occupied' : 'available');
    } catch (err) {
      console.error('Error refrescando estado de mesa:', err);
    }
  };

  // Abrir/confirmar mesa sin productos: crea pedido en preparación o continúa el existente
  const handleOpenOrderWithoutItems = async () => {
    if (!user) {
      toast.error('Debe iniciar sesión para abrir un pedido');
      return;
    }
    if (serviceType !== 'dine_in') {
      toast.error('Seleccione servicio En sala');
      return;
    }
    if (!tableId) {
      toast.error('Seleccione una mesa');
      return;
    }

    if (activeOrderId) {
      toast('Ya hay un pedido activo');
      return;
    }

    setLoading(true);
    try {
      // Verificar si ya existe un pedido en preparación para esta mesa
      const { data: existingPreparing, error: checkErr } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('table_id', tableId)
        .eq('status', 'preparing')
        .order('created_at', { ascending: false });
      if (checkErr) throw checkErr;

      if (existingPreparing && existingPreparing.length > 0) {
        setActiveOrderId(existingPreparing[0].id);
        toast.success('Continuando pedido existente para la mesa');
      } else {
        // Crear pedido vacío en preparación
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            employee_id: user.id,
            status: 'preparing',
            total: 0,
            payment_method: paymentMethod,
            service_type: 'dine_in',
            table_id: tableId,
          })
          .select()
          .single();
        if (orderErr) throw orderErr;

        setActiveOrderId(order.id);
        await updateTableStatus(tableId, 'occupied');
        toast.success('Mesa confirmada. Pedido abierto.');
      }
    } catch (err) {
      console.error('Error abriendo pedido sin productos:', err);
      toast.error('No se pudo abrir el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) {
      console.log('Carrito vacío o usuario no autenticado:', { cartLength: cart.length, userId: user?.id });
      return;
    }

    setLoading(true);
    try {
      if (serviceType === 'dine_in' && !tableId) {
        toast.error('Seleccione una mesa para servicio en sala');
        setLoading(false);
        return;
      }
      console.log('Iniciando checkout con:', { 
        employeeId: user.id, 
        total, 
        paymentMethod,
        cartItems: cart.length,
        serviceType,
        tableId,
        activeOrderId
      });

      // Preparar datos comunes
      const orderItemsPayload = cart.map(item => ({
        product_id: item.product.id,
        size_id: item.size?.id || null,
        quantity: item.quantity,
        unit_price: Number(item.product.base_price) + Number(item.size?.price_modifier || 0),
        subtotal: (Number(item.product.base_price) + Number(item.size?.price_modifier || 0)) * item.quantity,
        notes: item.notes,
      }));
      const deltaTotal = orderItemsPayload.reduce((sum, it) => sum + Number(it.subtotal), 0);
      const ticketItems = cart.map(ci => ({
        name: ci.product.name,
        size: ci.size?.size_name,
        quantity: ci.quantity,
        price: ci.product.base_price + (ci.size?.price_modifier || 0),
      }));

      // helpers están definidos fuera

      if (!activeOrderId) {
        // Crear nueva orden
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            employee_id: user.id,
            status: validateDirectly ? 'completed' : 'preparing',
            total,
            payment_method: paymentMethod,
            service_type: serviceType,
            table_id: serviceType === 'dine_in' ? tableId : null,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderItems = orderItemsPayload.map(it => ({ ...it, order_id: order.id }));
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems)
          .select();
        if (itemsError) throw itemsError;

        setTicket({
          orderDate: new Date(order.created_at),
          orderNumber: order.id,
          items: ticketItems,
          total,
          paymentMethod,
          cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
        });

        // Actualizar estado de mesa
        if (serviceType === 'dine_in' && tableId) {
          if (validateDirectly) {
            await refreshTableStatusBasedOnOrders(tableId);
          } else {
            await updateTableStatus(tableId, 'occupied');
          }
        }
      } else {
        // Agregar productos a orden existente
        const { data: existingOrder, error: existingErr } = await supabase
          .from('orders')
          .select('id,total,table_id,status,created_at')
          .eq('id', activeOrderId)
          .single();
        if (existingErr || !existingOrder) throw existingErr || new Error('Orden no encontrada');

        const orderItems = orderItemsPayload.map(it => ({ ...it, order_id: activeOrderId }));
        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(orderItems);
        if (itemsErr) throw itemsErr;

        const newStatus = validateDirectly ? 'completed' : 'preparing';
        const prevTotal = typeof existingOrder.total === 'string' ? parseFloat(existingOrder.total) : (existingOrder.total || 0);
        const newTotal = prevTotal + deltaTotal;
        const { error: updateErr } = await supabase
          .from('orders')
          .update({ total: newTotal, status: newStatus, payment_method: paymentMethod })
          .eq('id', activeOrderId);
        if (updateErr) throw updateErr;

        setTicket({
          orderDate: new Date(),
          orderNumber: activeOrderId,
          items: ticketItems,
          total: newTotal,
          paymentMethod,
          cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
        });

        if (existingOrder.table_id) {
          if (validateDirectly) {
            await refreshTableStatusBasedOnOrders(existingOrder.table_id);
          } else {
            await updateTableStatus(existingOrder.table_id, 'occupied');
          }
        }

        // Refrescar contenido del pedido activo tras añadir
        setExistingOrderTotal(newTotal);
        setExistingItems(prev => [
          ...prev,
          ...ticketItems.map(it => ({ ...it, subtotal: it.price * it.quantity }))
        ]);
      }

      // Ticket ya se establece dentro de cada rama

      clearCart();
      toast.success(validateDirectly ? '¡Orden validada!' : (activeOrderId ? '¡Productos añadidos al pedido!' : '¡Orden creada exitosamente!'));
      if (validateDirectly) {
        setActiveOrderId(null);
        setTableId(null);
        setServiceType('takeaway');
      }
      
      // Forzar actualización inmediata
      const channel = supabase.channel('custom-insert-channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (payload) => {
            console.log('Cambio detectado:', payload);
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Error creating order:', err);
      toast.error('Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-gray-50">
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 bg-white border-b">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Productos</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => {
              const productSizesList = productSizes(product.id);

            return (
              <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4">
                {product.image_url && product.image_url.length > 0 && (
                  <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden mb-3">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                <p className="text-lg font-bold text-amber-600 mb-3">${product.base_price.toFixed(2)}</p>

                {productSizesList.length > 0 ? (
                  <div className="space-y-2">
                    {productSizesList.map(size => (
                      <button
                        key={size.id}
                        onClick={() => addItem(product, size)}
                        className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center"
                      >
                        <span>{size.size_name}</span>
                        <span>+${size.price_modifier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Agregar
                  </button>
                )}
              </div>
            );
            })}
          </div>
          
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                className="bg-white hover:bg-gray-50 text-amber-600 font-medium py-3 px-6 rounded-lg shadow-sm transition-colors"
              >
                Cargar más productos
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-amber-600" />
            <h2 className="text-lg font-bold text-gray-900">Carrito</h2>
          </div>
        </div>

        {activeOrderId && (
          <div className="px-3 pt-3 pb-2 border-b bg-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Pedido activo #{activeOrderId}</h3>
                <p className="text-xs text-gray-600">Total actual: <span className="font-semibold">${existingOrderTotal.toFixed(2)}</span></p>
              </div>
              <button
                onClick={() => {
                  setActiveOrderId(null);
                  setTableId(null);
                  setServiceType('takeaway');
                  toast.success('Pedido finalizado');
                }}
                className="px-3 py-2 rounded-lg border-2 text-xs bg-white transition-colors hover:bg-gray-50 border-amber-600 text-amber-700"
              >
                Finalizar pedido
              </button>
            </div>
            <div className="mt-2 space-y-2 max-h-40 overflow-auto">
              {existingItems.length === 0 ? (
                <p className="text-xs text-gray-500">Sin productos registrados en el pedido.</p>
              ) : (
                existingItems.map((it, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-gray-900 font-medium">
                        {it.quantity}x {it.name}{it.size ? ` (${it.size})` : ''}
                      </div>
                      <div className="text-xs font-semibold text-amber-700">${it.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="text-[11px] text-gray-600">c/u ${it.price.toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500 text-sm">El carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-2">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {item.quantity}x {item.product.name}
                        {item.size && ` (${item.size.size_name})`}
                      </h4>
                      <p className="text-xs text-gray-600">
                        c/u ${ (item.product.base_price + (item.size?.price_modifier || 0)).toFixed(2) }
                      </p>
                      {item.size && (
                        <></>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-7 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="font-bold text-amber-600 text-sm">
                      Total ${((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-gray-50">
          <div className="flex justify-between items-center text-lg font-bold mb-3">
            <span>{activeOrderId ? 'Añadir:' : 'Total:'}</span>
            <span className="text-amber-600">${total.toFixed(2)}</span>
          </div>

          {activeOrderId && (
            <div className="space-y-1 mb-3">
              <div className="flex justify-between items-center text-xs">
                <span>Total pedido actual:</span>
                <span className="font-semibold">${existingOrderTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Total después de añadir:</span>
                <span className="font-semibold text-amber-700">${(existingOrderTotal + total).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  paymentMethod === 'cash'
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Banknote className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs">Efectivo</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  paymentMethod === 'card'
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs">Tarjeta</span>
              </button>
              <button
                onClick={() => setPaymentMethod('digital')}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  paymentMethod === 'digital'
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Smartphone className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs">Digital</span>
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">Servicio</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setServiceType('takeaway')}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  serviceType === 'takeaway' ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Para llevar
              </button>
              <button
                onClick={() => setServiceType('dine_in')}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  serviceType === 'dine_in' ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                En sala
              </button>
            </div>
            {serviceType === 'dine_in' && (
              <div className="flex gap-2 items-center">
                <select
                  value={tableId || ''}
                  onChange={(e) => setTableId(e.target.value || null)}
                  className="flex-1 px-2 py-2 rounded-lg border-2 bg-white text-sm"
                >
                  <option value="">Seleccione mesa</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} • {t.seats} plazas • {t.status === 'available' ? 'Disponible' : t.status === 'occupied' ? 'Ocupada' : 'Reservada'}
                    </option>
                  ))}
                </select>
                {/* Botón para confirmar mesa sin productos y abrir pedido */}
                {tableId && !activeOrderId && (
                  <button
                    onClick={handleOpenOrderWithoutItems}
                    disabled={loading}
                    className="px-2 py-2 rounded-lg border-2 bg-white transition-colors text-xs border-amber-600 text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar mesa
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">Opciones</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setValidateDirectly(!validateDirectly)}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  validateDirectly ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Validar directamente
              </button>
              <button
                onClick={() => setPrintAutomatically(!printAutomatically)}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  printAutomatically ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Imprimir ticket automáticamente
              </button>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Procesando...' : 'Procesar Orden'}
          </button>

          {ticket && (
            <div className="mt-2">
              <TicketPrinter
                orderDate={ticket.orderDate}
                orderNumber={ticket.orderNumber}
                items={ticket.items}
                total={ticket.total}
                paymentMethod={ticket.paymentMethod}
                cashierName={ticket.cashierName}
                autoPrint={printAutomatically}
                hideButton={printAutomatically}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

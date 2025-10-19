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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
            payment_method: paymentMethod || 'cash',
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

      // Show payment method modal when validating directly
      console.log('Checkout flow check:', {
        validateDirectly,
        paymentMethod,
        hasCart: cart.length > 0,
        showPaymentModal,
        step: 'initial_check'
      });

      // If payment modal is already showing, don't proceed with checkout yet
      if (showPaymentModal) {
        console.log('Payment modal is showing, waiting for user selection');
        setLoading(false);
        return;
      }

      // ALWAYS show payment modal when validating directly if no payment method selected
      if (validateDirectly && cart.length > 0 && !paymentMethod) {
        console.log('Showing payment modal - validating directly, no payment method');
        setShowPaymentModal(true);
        setLoading(false);
        return;
      }

      // If validateDirectly is true and payment method is selected, continue with checkout
      if (validateDirectly && cart.length > 0 && paymentMethod) {
        console.log('Proceeding with validated checkout - payment method:', paymentMethod);
        // Continue with normal checkout flow
      } else if (!validateDirectly && cart.length > 0) {
        console.log('Normal checkout flow - not validating directly');
        // Continue with normal checkout flow (will use default 'cash' if no method selected)
      } else {
        console.log('No valid checkout conditions met, stopping');
        setLoading(false);
        return;
      }

      // Continue with the rest of the checkout logic...
      console.log('Continuing with checkout logic for:', {
        paymentMethod,
        cartLength: cart.length,
        validateDirectly,
        activeOrderId
      });

      // ===== MAIN CHECKOUT PROCESSING =====
      // (The existing checkout logic should continue from here)

      // The rest of the checkout logic continues below...

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
            payment_method: paymentMethod || 'cash',
            service_type: serviceType,
            table_id: serviceType === 'dine_in' ? tableId : null,
          })
          .select('id,total,created_at,order_number')
          .single();

        if (orderError) throw orderError;

        const orderItems = orderItemsPayload.map(it => ({ ...it, order_id: order.id }));
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems)
          .select();
        if (itemsError) throw itemsError;

        if (validateDirectly && paymentMethod) {
          setTicket({
            orderDate: new Date(order.created_at),
            orderNumber: order.order_number ? `#${order.order_number.toString().padStart(3, '0')}` : `#${order.id.slice(-3).toUpperCase()}`,
            items: ticketItems,
            total,
            paymentMethod,
            cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
          });
        }

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
          .select('id,total,table_id,status,created_at,order_number')
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
          .update({ total: newTotal, status: newStatus, payment_method: paymentMethod || 'cash' })
          .eq('id', activeOrderId);
        if (updateErr) throw updateErr;

        if (validateDirectly && paymentMethod) {
          setTicket({
            orderDate: new Date(),
            orderNumber: existingOrder.order_number ? `#${existingOrder.order_number.toString().padStart(3, '0')}` : `#${activeOrderId.slice(-3).toUpperCase()}`,
            items: ticketItems,
            total: newTotal,
            paymentMethod,
            cashierName: (user as any)?.user_metadata?.full_name || user.email || 'Usuario',
          });
        }

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

  // Vista móvil
  const renderMobileView = () => (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-gray-50">
      {/* Filtros de categoría móvil */}
      <div className="bg-white p-3 border-b">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos móvil */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {products.map(product => {
            const productSizesList = productSizes(product.id);
            return (
              <div key={product.id} className="bg-white rounded-lg p-3 shadow-sm border">
                <div className="flex gap-3">
                  {product.image_url && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{product.description}</p>
                    <p className="text-lg font-bold text-amber-600 mt-1">${product.base_price.toFixed(2)}</p>
                  </div>
                </div>

                {productSizesList.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {productSizesList.map(size => (
                      <button
                        key={size.id}
                        onClick={() => addItem(product, size)}
                        className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 px-3 rounded-lg text-sm font-medium flex justify-between items-center"
                      >
                        <span>{size.size_name}</span>
                        <span className="font-bold">+${size.price_modifier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg font-semibold mt-2 text-sm"
                  >
                    Agregar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen del pedido móvil (fixed en la parte inferior) */}
      <div className="bg-white border-t shadow-lg p-4 space-y-3">
        {/* Total y cantidad de items */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">Total del pedido</p>
            <p className="text-2xl font-bold text-amber-600">${total.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Items</p>
            <p className="text-xl font-bold text-gray-900">{cart.length}</p>
          </div>
        </div>

        {/* Opciones de servicio */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setServiceType('takeaway')}
            className={`py-2 px-3 rounded-lg text-sm font-medium ${
              serviceType === 'takeaway' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Para llevar
          </button>
          <button
            onClick={() => setServiceType('dine_in')}
            className={`py-2 px-3 rounded-lg text-sm font-medium ${
              serviceType === 'dine_in' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            En sala
          </button>
        </div>

        {serviceType === 'dine_in' && (
          <select
            value={tableId || ''}
            onChange={(e) => setTableId(e.target.value || null)}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
          >
            <option value="">Seleccione mesa</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} • {t.status === 'available' ? 'Disponible' : 'Ocupada'}
              </option>
            ))}
          </select>
        )}

        {/* Validar directamente */}
        <button
          onClick={() => setValidateDirectly(!validateDirectly)}
          className={`w-full py-2 px-3 rounded-lg text-sm font-medium ${
            validateDirectly ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {validateDirectly ? '✓ Validar directamente' : 'Validar directamente'}
        </button>

        {/* Botón confirmar */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || loading}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Procesando...' : 'Confirmar Pedido'}
        </button>

        {/* Ver carrito */}
        {cart.length > 0 && (
          <button
            onClick={() => {
              // Scroll to top to show cart details
              const modal = document.createElement('div');
              modal.innerHTML = `
                <div class="fixed inset-0 bg-black/50 z-50 flex items-end" onclick="this.remove()">
                  <div class="bg-white w-full max-h-[70vh] rounded-t-2xl p-4 overflow-y-auto" onclick="event.stopPropagation()">
                    <h3 class="text-lg font-bold mb-4">Carrito (${cart.length} items)</h3>
                    ${cart.map((item, index) => `
                      <div class="flex justify-between items-center py-2 border-b">
                        <div class="flex-1">
                          <p class="font-medium text-sm">${item.quantity}x ${item.product.name}${item.size ? ` (${item.size.size_name})` : ''}</p>
                          <p class="text-xs text-gray-500">$${(item.product.base_price + (item.size?.price_modifier || 0)).toFixed(2)} c/u</p>
                        </div>
                        <p class="font-bold text-amber-600">$${((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity).toFixed(2)}</p>
                      </div>
                    `).join('')}
                    <div class="mt-4 pt-4 border-t flex justify-between">
                      <span class="font-bold">Total:</span>
                      <span class="font-bold text-amber-600 text-xl">$${total.toFixed(2)}</span>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="w-full mt-4 bg-gray-200 py-2 rounded-lg">Cerrar</button>
                  </div>
                </div>
              `;
              document.body.appendChild(modal);
            }}
            className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium"
          >
            Ver Carrito Detallado
          </button>
        )}
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
      <div className="hidden md:flex h-[calc(100vh-5rem)] bg-gray-50">
        <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 p-4 border-b border-amber-200">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-300 scrollbar-track-transparent">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map(product => {
              const productSizesList = productSizes(product.id);

            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-4 border border-gray-100 hover:border-amber-200 group">
                {product.image_url && product.image_url.length > 0 && (
                  <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden mb-3 shadow-inner">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                )}
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">{product.name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-amber-600">${product.base_price.toFixed(2)}</p>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-600 font-medium">Disponible</span>
                    </div>
                  </div>
                </div>

                {productSizesList.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {productSizesList.map(size => (
                      <button
                        key={size.id}
                        onClick={() => addItem(product, size)}
                        className="w-full bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-700 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex justify-between items-center border border-amber-200 hover:border-amber-300 shadow-sm hover:shadow-md"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-xs">📏</span>
                          {size.size_name}
                        </span>
                        <span className="font-bold">+${size.price_modifier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3 px-4 rounded-lg font-bold transition-all duration-200 mt-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-sm">➕</span>
                      Agregar al carrito
                    </span>
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

      <div className="w-80 bg-gradient-to-b from-white to-gray-50 border-l border-gray-200 flex flex-col shadow-xl">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Carrito de Compras</h2>
              <p className="text-xs opacity-90">{cart.length} productos</p>
            </div>
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
            <div className="mt-2 space-y-2 max-h-32 overflow-auto">
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
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium">El carrito está vacío</p>
              <p className="text-gray-400 text-xs mt-1">Selecciona productos para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.slice().reverse().map((item, index) => (
                <div key={cart.length - 1 - index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm leading-tight">
                        {item.quantity}x {item.product.name}
                        {item.size && ` (${item.size.size_name})`}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        c/u ${ (item.product.base_price + (item.size?.price_modifier || 0)).toFixed(2) }
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(cart.length - 1 - index)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                      <button
                        onClick={() => updateQuantity(cart.length - 1 - index, -1)}
                        className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-gray-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(cart.length - 1 - index, 1)}
                        className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-bold text-amber-600 text-sm bg-amber-50 px-2 py-1 rounded-lg">
                      ${((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gradient-to-b from-gray-50 to-white space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center text-xl font-bold">
              <span className="text-gray-700">{activeOrderId ? 'Añadir:' : 'Total:'}</span>
              <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">${total.toFixed(2)}</span>
            </div>

            {activeOrderId && (
              <div className="mt-3 space-y-2 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total pedido actual:</span>
                  <span className="font-semibold text-gray-900">${existingOrderTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total después de añadir:</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">${(existingOrderTotal + total).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>


          <div>
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
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Opciones</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setValidateDirectly(!validateDirectly)}
                className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${
                  validateDirectly ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Validar directamente
              </button>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <span className="text-base">✅</span>
                  Confirmar Pedido
                </>
              )}
            </span>
          </button>

          {ticket && validateDirectly && (
            <div className="mt-2">
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
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Método de Pago</h2>

            <div className="grid grid-cols-1 gap-3 mb-6">
              <button
                onClick={() => {
                  console.log('Selecting cash payment method');
                  setPaymentMethod('cash');
                  setShowPaymentModal(false);
                  // Call handleCheckout after a brief delay to ensure state is updated
                  setTimeout(() => {
                    console.log('Calling handleCheckout for cash payment, paymentMethod:', paymentMethod);
                    handleCheckout();
                  }, 100);
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
                  console.log('Selecting card payment method');
                  setPaymentMethod('card');
                  setShowPaymentModal(false);
                  // Call handleCheckout after a brief delay to ensure state is updated
                  setTimeout(() => {
                    console.log('Calling handleCheckout for card payment, paymentMethod:', paymentMethod);
                    handleCheckout();
                  }, 100);
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
                  console.log('Selecting digital payment method');
                  setPaymentMethod('digital');
                  setShowPaymentModal(false);
                  // Call handleCheckout after a brief delay to ensure state is updated
                  setTimeout(() => {
                    console.log('Calling handleCheckout for digital payment, paymentMethod:', paymentMethod);
                    handleCheckout();
                  }, 100);
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
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

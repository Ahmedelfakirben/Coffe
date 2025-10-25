import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Category, Product, ProductSize } from '../types/supabase';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import { TicketPrinter } from './TicketPrinter';
import { toast } from 'react-hot-toast';

const ITEMS_PER_PAGE = 12;

export function POS() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{
    orderDate: Date;
    orderNumber: string;
    items: Array<{ name: string; size?: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    cashierName: string;
  } | null>(null);
  const [existingItems, setExistingItems] = useState<Array<{ name: string; size?: string; quantity: number; price: number; subtotal: number }>>([]);
  const [existingOrderTotal, setExistingOrderTotal] = useState<number>(0);
  const [existingOrderNumber, setExistingOrderNumber] = useState<number | null>(null);
  const [canConfirmOrder, setCanConfirmOrder] = useState(true);
  const [canValidateOrder, setCanValidateOrder] = useState(true);
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

  // Cargar permisos granulares para POS
  useEffect(() => {
    const fetchPOSPermissions = async () => {
      if (!profile?.role) return;

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('can_confirm_order, can_validate_order')
          .eq('role', profile.role)
          .eq('page_id', 'pos')
          .single();

        if (error) {
          console.error('Error fetching POS permissions:', error);
          return;
        }

        if (data) {
          setCanConfirmOrder(data.can_confirm_order ?? true);
          setCanValidateOrder(data.can_validate_order ?? true);
        }
      } catch (err) {
        console.error('Error loading POS permissions:', err);
      }
    };

    fetchPOSPermissions();
  }, [profile?.role]);

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

  // Limpiar ticket después de imprimir
  useEffect(() => {
    if (ticket) {
      console.log('🎫 POS: Ticket establecido, esperando impresión...', new Date().toISOString());

      let cleaned = false;

      // Escuchar evento de impresión completada
      const handleTicketPrinted = () => {
        if (!cleaned) {
          console.log('🎫 POS: Evento ticketPrinted recibido, limpiando ticket', new Date().toISOString());
          cleaned = true;
          setTicket(null);
        }
      };

      // Timeout de fallback de 10 segundos por si el evento no se dispara
      const timer = setTimeout(() => {
        if (!cleaned) {
          console.log('🎫 POS: Timeout alcanzado, limpiando ticket (fallback)', new Date().toISOString());
          cleaned = true;
          setTicket(null);
        }
      }, 10000);

      window.addEventListener('ticketPrinted', handleTicketPrinted);

      return () => {
        console.log('🎫 POS: Cleanup - removiendo listener y timer');
        window.removeEventListener('ticketPrinted', handleTicketPrinted);
        clearTimeout(timer);
      };
    }
  }, [ticket]);

  // Cargar contenido de pedido activo si existe
  useEffect(() => {
    const loadActiveOrderContent = async () => {
      if (!activeOrderId) {
        setExistingItems([]);
        setExistingOrderTotal(0);
        setExistingOrderNumber(null);
        return;
      }
      try {
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .select('id, total, order_number')
          .eq('id', activeOrderId)
          .single();
        if (orderErr) throw orderErr;
        const currentTotal = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
        setExistingOrderTotal(currentTotal);
        setExistingOrderNumber(order.order_number || null);

        const { data: items, error: itemsErr } = await supabase
          .from('order_items')
          .select('quantity, unit_price, subtotal, size_id, product_id, products(name), product_sizes(size_name)')
          .eq('order_id', activeOrderId);
        if (itemsErr) throw itemsErr;
        const mapped = (items || []).map((it: any) => ({
          name: it.products?.name || 'Producto',
          size: it.product_sizes?.size_name || undefined,
          quantity: it.quantity,
          price: typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : (it.unit_price || 0),
          subtotal: typeof it.subtotal === 'string' ? parseFloat(it.subtotal) : (it.subtotal || 0),
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

  // Helper function to insert order items
  const insertOrderItems = async (orderItemsPayload: any[], orderId: string) => {
    const orderItems = orderItemsPayload.map(it => ({ ...it, order_id: orderId }));
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();
    if (itemsError) throw itemsError;
    return items;
  };

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

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) {
      console.log('Carrito vacío o usuario no autenticado:', { cartLength: cart.length, userId: user?.id });
      return;
    }

    // Verificar permisos granulares
    if (!canConfirmOrder) {
      toast.error('No tienes permiso para confirmar pedidos');
      return;
    }

    setLoading(true);
    try {
      if (serviceType === 'dine_in' && !tableId) {
        toast.error('Seleccione una mesa para servicio en sala');
        setLoading(false);
        return;
      }

      // Crear orden como pendiente y mostrar modal de confirmación
      console.log('Checkout flow check:', {
        hasCart: cart.length > 0,
        step: 'creating_pending_order'
      });

      // Continue with the rest of the checkout logic...
      console.log('Continuing with checkout logic for:', {
        paymentMethod,
        cartLength: cart.length,
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
        // Crear nueva orden como pendiente (sin payment_method todavía)
        const { data: order, error: orderError} = await supabase
          .from('orders')
          .insert({
            employee_id: user.id,
            status: 'preparing', // Pendiente de validación
            total,
            payment_method: null, // Se establecerá cuando valide
            service_type: serviceType,
            table_id: serviceType === 'dine_in' ? tableId : null,
          })
          .select('id,total,created_at,order_number')
          .single();

        if (orderError) throw orderError;

        await insertOrderItems(orderItemsPayload, order.id);

        // Store ticket data for later validation and printing
        const ticketData = {
          orderDate: new Date(order.created_at),
          orderNumber: order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8),
          items: ticketItems,
          total,
          paymentMethod: 'Pendiente',
          cashierName: (user.user_metadata as any)?.full_name || user.email || 'Usuario',
        };

        setPendingOrderData(ticketData);
        setActiveOrderId(order.id); // Guardar el ID de la orden pendiente
        setShowValidationModal(true);

        // Actualizar estado de mesa
        if (serviceType === 'dine_in' && tableId) {
          await updateTableStatus(tableId, 'occupied');
        }
      } else {
        // Agregar productos a orden existente
        const { data: existingOrder, error: existingErr } = await supabase
          .from('orders')
          .select('id,total,table_id,status,created_at,order_number')
          .eq('id', activeOrderId)
          .single();
        if (existingErr || !existingOrder) throw existingErr || new Error('Orden no encontrada');

        await insertOrderItems(orderItemsPayload, activeOrderId);

        const newStatus = 'preparing'; // Always keep as preparing until validation
        const prevTotal = typeof existingOrder.total === 'string' ? parseFloat(existingOrder.total) : (existingOrder.total || 0);
        const newTotal = prevTotal + deltaTotal;
        const { error: updateErr } = await supabase
          .from('orders')
          .update({ total: newTotal, status: newStatus, payment_method: paymentMethod || 'cash' })
          .eq('id', activeOrderId);
        if (updateErr) throw updateErr;

        // Store ticket data for later validation and printing
        const ticketData = {
          orderDate: new Date(),
          orderNumber: existingOrder.order_number ? `#${existingOrder.order_number.toString().padStart(3, '0')}` : `#${activeOrderId.slice(-3).toUpperCase()}`,
          items: ticketItems,
          total: newTotal,
          paymentMethod: 'Pendiente',
          cashierName: (user.user_metadata as any)?.full_name || user.email || 'Usuario',
        };

        setPendingOrderData(ticketData);
        setShowValidationModal(true);

        if (existingOrder.table_id) {
          await updateTableStatus(existingOrder.table_id, 'occupied');
        }

        // Refrescar contenido del pedido activo tras añadir
        setExistingOrderTotal(newTotal);
        setExistingItems(prev => [
          ...prev,
          ...ticketItems.map(it => ({ ...it, subtotal: it.price * it.quantity }))
        ]);
      }

      toast.success(activeOrderId ? '¡Productos añadidos al pedido!' : '¡Orden creada exitosamente!');
      // Don't reset anything yet - wait for validation
      
      // Forzar actualización inmediata - Nota: Canal removido para evitar memory leaks
      // Si se necesita monitoreo en tiempo real, implementar con cleanup adecuado
    } catch (err) {
      console.error('Error creating order:', err);
      toast.error('Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAndPrint = async () => {
    if (pendingOrderData) {
      console.log('Usuario eligió validar e imprimir - mostrando modal de pago');

      // Cerrar modal de validación y mostrar modal de método de pago
      setShowValidationModal(false);
      setShowPaymentModal(true);
    }
  };

  const handlePaymentMethodSelection = async (selectedPaymentMethod: string) => {
    if (!pendingOrderData || !activeOrderId) {
      console.error('No hay orden pendiente o activeOrderId');
      return;
    }

    try {
      console.log('Validando orden con método de pago:', selectedPaymentMethod);

      // Actualizar la orden con el método de pago y completarla
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_method: selectedPaymentMethod
        })
        .eq('id', activeOrderId);

      if (updateError) throw updateError;

      // Actualizar los datos del ticket con el método de pago
      const updatedTicketData = {
        ...pendingOrderData,
        paymentMethod: selectedPaymentMethod === 'cash' ? 'Efectivo' :
                      selectedPaymentMethod === 'card' ? 'Tarjeta' : 'Digital'
      };

      // Imprimir ticket
      console.log('Setting ticket for auto-print:', updatedTicketData);
      setTicket(updatedTicketData);
      setShowPaymentModal(false);
      setPendingOrderData(null);

      // Reset states after successful validation
      setActiveOrderId(null);
      setTableId(null);
      setServiceType('takeaway');
      setPaymentMethod(null);
      clearCart();

      toast.success('¡Orden validada e impresa!');
    } catch (error) {
      console.error('Error validating order:', error);
      toast.error('Error al validar la orden');
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('Cargando productos...')}</p>
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
            {t('Reintentar')}
          </button>
        </div>
      </div>
    );
  }

  // Vista móvil
  const renderMobileView = () => (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-gray-50">
      {/* Filtros de categoría móvil */}
      {/* Sección de Categorías Móvil - Diseño Minimalista */}
      <div className="bg-white border-b border-gray-200 px-3 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            {t('Todos')}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                  : 'bg-gray-50 text-gray-700 border border-gray-200'
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
                    <p className="text-lg font-bold text-amber-600 mt-1">{formatCurrency(product.base_price)}</p>
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
                        <span className="font-bold">+{formatCurrency(size.price_modifier)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg font-semibold mt-2 text-sm"
                  >
                    {t('Agregar')}
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
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(total)}</p>
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
            {t('Para llevar')}
          </button>
          <button
            onClick={() => setServiceType('dine_in')}
            className={`py-2 px-3 rounded-lg text-sm font-medium ${
              serviceType === 'dine_in' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t('En sala')}
          </button>
        </div>

        {serviceType === 'dine_in' && (
          <select
            value={tableId || ''}
            onChange={(e) => setTableId(e.target.value || null)}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
          >
            <option value="">{t('Seleccione mesa')}</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} • {t.status === 'available' ? 'Disponible' : 'Ocupada'}
              </option>
            ))}
          </select>
        )}


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
              // Create cart details modal using React approach instead of innerHTML
              const modal = document.createElement('div');
              modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-end';
              modal.onclick = () => modal.remove();

              const modalContent = document.createElement('div');
              modalContent.className = 'bg-white w-full max-h-[70vh] rounded-t-2xl p-4 overflow-y-auto';
              modalContent.onclick = (e) => e.stopPropagation();

              // Header
              const header = document.createElement('h3');
              header.className = 'text-lg font-bold mb-4';
              header.textContent = `Carrito (${cart.length} items)`;

              // Cart items
              cart.forEach((item) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex justify-between items-center py-2 border-b';

                const itemInfo = document.createElement('div');
                itemInfo.className = 'flex-1';

                const itemName = document.createElement('p');
                itemName.className = 'font-medium text-sm';
                itemName.textContent = `${item.quantity}x ${item.product.name}${item.size ? ` (${item.size.size_name})` : ''}`;

                const itemPrice = document.createElement('p');
                itemPrice.className = 'text-xs text-gray-500';
                itemPrice.textContent = `${formatCurrency(item.product.base_price + (item.size?.price_modifier || 0))} c/u`;

                const itemTotal = document.createElement('p');
                itemTotal.className = 'font-bold text-amber-600';
                itemTotal.textContent = formatCurrency((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity);

                itemInfo.appendChild(itemName);
                itemInfo.appendChild(itemPrice);
                itemDiv.appendChild(itemInfo);
                itemDiv.appendChild(itemTotal);

                modalContent.appendChild(itemDiv);
              });

              // Total section
              const totalDiv = document.createElement('div');
              totalDiv.className = 'mt-4 pt-4 border-t flex justify-between';

              const totalLabel = document.createElement('span');
              totalLabel.className = 'font-bold';
              totalLabel.textContent = 'Total:';

              const totalAmount = document.createElement('span');
              totalAmount.className = 'font-bold text-amber-600 text-xl';
              totalAmount.textContent = formatCurrency(total);

              totalDiv.appendChild(totalLabel);
              totalDiv.appendChild(totalAmount);

              // Close button
              const closeButton = document.createElement('button');
              closeButton.className = 'w-full mt-4 bg-gray-200 py-2 rounded-lg';
              closeButton.textContent = 'Cerrar';
              closeButton.onclick = () => modal.remove();

              modalContent.appendChild(header);
              modalContent.appendChild(totalDiv);
              modalContent.appendChild(closeButton);
              modal.appendChild(modalContent);
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

      {/* Ticket Auto-Print */}
      {ticket && (
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
      )}

      {/* Vista Desktop */}
      <div className="hidden md:flex h-[calc(100vh-5rem)] bg-gray-50">
        <div className="flex-1 overflow-hidden flex flex-col">
        {/* Sección de Categorías - Diseño Minimalista Moderno */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                }`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map(product => {
              const productSizesList = productSizes(product.id);

            return (
              <div key={product.id} className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-5 border-2 border-gray-100 hover:border-amber-300 group relative overflow-hidden">
                {/* Gradient Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 to-orange-50/0 group-hover:from-amber-50/50 group-hover:to-orange-50/50 transition-all duration-300 rounded-3xl pointer-events-none"></div>

                {product.image_url && product.image_url.length > 0 && (
                  <div className="relative w-full h-36 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl overflow-hidden mb-4 shadow-md group-hover:shadow-lg transition-shadow duration-300">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                )}
                <div className="space-y-3 relative z-10">
                  <h3 className="font-extrabold text-gray-900 text-base leading-tight group-hover:text-amber-700 transition-colors">{product.name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{product.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <p className="text-xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{formatCurrency(product.base_price)}</p>
                    <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-700 font-bold">Stock</span>
                    </div>
                  </div>
                </div>

                {productSizesList.length > 0 ? (
                  <div className="space-y-2 mt-4 relative z-10">
                    {productSizesList.map(size => (
                      <button
                        key={size.id}
                        onClick={() => addItem(product, size)}
                        className="w-full bg-gradient-to-r from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 text-amber-800 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex justify-between items-center border-2 border-amber-300 hover:border-amber-400 shadow-md hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">📏</span>
                          <span>{size.size_name}</span>
                        </span>
                        <span className="font-black text-amber-900">+{formatCurrency(size.price_modifier)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3.5 px-4 rounded-xl font-black transition-all duration-200 mt-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 relative z-10"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" />
                      {t('Agregar al carrito')}
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
                {t('Cargar más productos')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-80 bg-gradient-to-b from-gray-50 to-white border-l-2 border-amber-200 flex flex-col shadow-2xl">
        <div className="p-5 border-b-2 border-amber-200 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-md">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{t('Carrito de Compras')}</h2>
              <p className="text-sm font-semibold opacity-95">{cart.length} productos</p>
            </div>
          </div>
        </div>

        {activeOrderId && (
          <div className="px-3 pt-3 pb-2 border-b bg-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Pedido activo #{activeOrderId}</h3>
                <p className="text-xs text-gray-600">Total actual: <span className="font-semibold">{formatCurrency(existingOrderTotal)}</span></p>
                <p className="text-xs text-amber-600 font-medium">Pendiente de validación</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Show validation modal for pending order
                    const ticketData = {
                      orderDate: new Date(),
                      orderNumber: existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-8),
                      items: existingItems,
                      total: existingOrderTotal,
                      paymentMethod: 'Pendiente',
                      cashierName: user ? ((user.user_metadata as any)?.full_name || user.email || 'Usuario') : 'Usuario',
                    };
                    setPendingOrderData(ticketData);
                    setShowValidationModal(true);
                  }}
                  className="px-3 py-2 rounded-lg border-2 text-xs bg-amber-600 text-white transition-colors hover:bg-amber-700"
                >
                  Validar
                </button>
                <button
                  onClick={() => {
                    setActiveOrderId(null);
                    setTableId(null);
                    setServiceType('takeaway');
                    toast.success('Pedido finalizado');
                  }}
                  className="px-3 py-2 rounded-lg border-2 text-xs bg-white transition-colors hover:bg-gray-50 border-amber-600 text-amber-700"
                >
                  Finalizar
                </button>
              </div>
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
                      <div className="text-xs font-semibold text-amber-700">{formatCurrency(it.subtotal)}</div>
                    </div>
                    <div className="text-[11px] text-gray-600">c/u {formatCurrency(it.price)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 bg-gradient-to-b from-gray-50 to-white">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl flex items-center justify-center mb-4 shadow-lg">
                <ShoppingCart className="w-10 h-10 text-amber-600" />
              </div>
              <p className="text-gray-600 text-base font-bold">{t('El carrito está vacío')}</p>
              <p className="text-gray-400 text-sm mt-2">{t('Selecciona productos para comenzar')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.slice().reverse().map((item, index) => (
                <div key={cart.length - 1 - index} className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-4 hover:shadow-xl hover:border-amber-200 transition-all duration-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-black text-gray-900 text-sm leading-tight">
                        {item.quantity}x {item.product.name}
                        {item.size && ` (${item.size.size_name})`}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 font-semibold">
                        c/u {formatCurrency(item.product.base_price + (item.size?.price_modifier || 0))}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(cart.length - 1 - index)}
                      className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-1.5 border border-amber-200">
                      <button
                        onClick={() => updateQuantity(cart.length - 1 - index, -1)}
                        className="w-7 h-7 rounded-lg bg-white border-2 border-amber-300 flex items-center justify-center hover:bg-amber-100 transition-all shadow-sm"
                      >
                        <Minus className="w-3.5 h-3.5 text-amber-700" />
                      </button>
                      <span className="w-9 text-center font-black text-base text-amber-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(cart.length - 1 - index, 1)}
                        className="w-7 h-7 rounded-lg bg-white border-2 border-amber-300 flex items-center justify-center hover:bg-amber-100 transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-700" />
                      </button>
                    </div>
                    <span className="font-black text-amber-700 text-base bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-1.5 rounded-xl border-2 border-amber-300 shadow-sm">
                      {formatCurrency((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t-2 border-amber-200 bg-gradient-to-b from-white to-gray-50 space-y-4 shadow-inner">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 shadow-lg border-2 border-amber-200">
            <div className="flex justify-between items-center text-2xl font-black">
              <span className="text-gray-800">{activeOrderId ? 'Añadir:' : 'Total:'}</span>
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent px-4 py-1 rounded-xl">{formatCurrency(total)}</span>
            </div>

            {activeOrderId && (
              <div className="mt-3 space-y-2 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total pedido actual:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(existingOrderTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total después de añadir:</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">{formatCurrency(existingOrderTotal + total)}</span>
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


          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white font-black py-5 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 hover:scale-105 disabled:transform-none border-2 border-amber-400"
          >
            <span className="flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-6 h-6" />
                  <span>{t('Confirmar Pedido')}</span>
                </>
              )}
            </span>
          </button>

        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 transform scale-100 transition-all">
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl mb-4">
                <CreditCard className="w-12 h-12 text-amber-600" />
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {t('Seleccionar Método de Pago')}
              </h2>
              <p className="text-sm text-gray-600 mt-2">{t('Elija cómo se realizará el pago')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-8">
              <button
                onClick={() => handlePaymentMethodSelection('cash')}
                className="group flex items-center gap-4 p-6 rounded-2xl border-3 bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 transition-all hover:border-green-500 hover:shadow-xl transform hover:-translate-y-1 hover:scale-102"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                  <Banknote className="w-8 h-8 text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-black text-gray-900 text-lg">{t('Efectivo')}</div>
                  <div className="text-sm text-gray-600 font-semibold">{t('Pago en efectivo')}</div>
                </div>
                <div className="text-3xl opacity-0 group-hover:opacity-100 transition-opacity">💵</div>
              </button>

              <button
                onClick={() => handlePaymentMethodSelection('card')}
                className="group flex items-center gap-4 p-6 rounded-2xl border-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 transition-all hover:border-blue-500 hover:shadow-xl transform hover:-translate-y-1 hover:scale-102"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-black text-gray-900 text-lg">{t('Tarjeta')}</div>
                  <div className="text-sm text-gray-600 font-semibold">{t('Pago con tarjeta')}</div>
                </div>
                <div className="text-3xl opacity-0 group-hover:opacity-100 transition-opacity">💳</div>
              </button>

              <button
                onClick={() => handlePaymentMethodSelection('digital')}
                className="group flex items-center gap-4 p-6 rounded-2xl border-3 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300 transition-all hover:border-purple-500 hover:shadow-xl transform hover:-translate-y-1 hover:scale-102"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-black text-gray-900 text-lg">{t('Digital')}</div>
                  <div className="text-sm text-gray-600 font-semibold">{t('Pago digital')}</div>
                </div>
                <div className="text-3xl opacity-0 group-hover:opacity-100 transition-opacity">📱</div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-bold text-gray-700 shadow-md hover:shadow-lg"
              >
                {t('Cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {showValidationModal && pendingOrderData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 transform scale-100 transition-all">
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                {t('Confirmar Pedido')}
              </h2>
              <p className="text-sm text-gray-600">{t('Pedido creado exitosamente')}</p>
            </div>

            <div className="mb-6">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 mb-4 shadow-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-800 text-sm">{t('Total del Pedido:')}</span>
                  <span className="font-black text-3xl bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {formatCurrency(pendingOrderData.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-amber-300">
                  <span className="font-bold text-gray-800 text-sm">{t('Método de Pago:')}</span>
                  <span className="font-bold text-amber-700 bg-white/60 px-3 py-1 rounded-lg">
                    {pendingOrderData.paymentMethod}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <span className="font-bold text-blue-800">ℹ️ {t('Información:')}</span><br/>
                {t('El pedido se ha procesado correctamente. ¿Desea validar e imprimir el ticket ahora?')}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  console.log('Order left pending - will be validated later');
                  setShowValidationModal(false);
                  setPendingOrderData(null);

                  // Reset states after leaving order pending
                  setActiveOrderId(null);
                  setTableId(null);
                  setServiceType('takeaway');
                  setPaymentMethod(null);
                  clearCart();

                  toast.success('Pedido pendiente de validación');
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-bold text-gray-700 shadow-md hover:shadow-lg"
              >
                {t('Después')}
              </button>
              <button
                onClick={handleValidateAndPrint}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
              >
                {t('Validar e Imprimir')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

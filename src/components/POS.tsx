import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Category, Product, ProductSize } from '../types/supabase';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle, ChevronLeft, ChevronRight, Coffee } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TicketPrinter } from './TicketPrinter';
import { isMobileDevice } from '../lib/qzTray';
import { enqueuePrintJob } from '../lib/spoolerService';

// Removed pagination - show all products per category

export function POS() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const mobileCategoryScrollRef = useRef<HTMLDivElement>(null);

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const scrollCategoryLeft = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollCategoryRight = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const scrollToCategoryPill = (catId: string) => {
    if (!mobileCategoryScrollRef.current) return;
    const btn = mobileCategoryScrollRef.current.querySelector(`[data-cat-id="${catId}"]`);
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleMobileTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleMobileTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Activar cambio de categoría si el gesto horizontal > 50px y es más horizontal que vertical
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const allCatIds = ['all', ...categories.map(c => c.id)];
      const currentIndex = allCatIds.indexOf(selectedCategory);

      if (deltaX < 0) {
        // Deslizar a la izquierda -> Siguiente categoría
        if (currentIndex < allCatIds.length - 1) {
          const nextCat = allCatIds[currentIndex + 1];
          setSelectedCategory(nextCat);
          scrollToCategoryPill(nextCat);
        }
      } else {
        // Deslizar a la derecha -> Categoría anterior
        if (currentIndex > 0) {
          const prevCat = allCatIds[currentIndex - 1];
          setSelectedCategory(prevCat);
          scrollToCategoryPill(prevCat);
        }
      }
    }
  };
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
    setActiveOrderId,
    setItemNotes
  } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  // Removed pagination states
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<{ id: string; name: string; seats: number; status: string }[]>([]);
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
  const [existingItems, setExistingItems] = useState<Array<{ id: string; name: string; size?: string; quantity: number; price: number; subtotal: number; notes?: string }>>([]);
  const [existingOrderTotal, setExistingOrderTotal] = useState<number>(0);
  const [existingOrderNumber, setExistingOrderNumber] = useState<number | null>(null);
  const [showMobileActiveModal, setShowMobileActiveModal] = useState(false);
  const [showMobileCartModal, setShowMobileCartModal] = useState(false);
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

  // Estados para notas de productos en carrito
  const [noteModalIndex, setNoteModalIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>('');

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
      const sorted = (data || []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      setTables(sorted);
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
  const loadActiveOrderContent = useCallback(async () => {
    if (!activeOrderId) {
      setExistingItems([]);
      setExistingOrderTotal(0);
      setExistingOrderNumber(null);
      return;
    }
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, total, order_number, table_id, service_type')
        .eq('id', activeOrderId)
        .single();
      if (orderErr) throw orderErr;
      const currentTotal = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
      setExistingOrderTotal(currentTotal);
      setExistingOrderNumber(order.order_number || null);
      if (order.table_id && !tableId) {
        setTableId(order.table_id);
      }
      if (order.service_type) {
        setServiceType(order.service_type as any);
      }

      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, quantity, unit_price, subtotal, size_id, product_id, notes, products(name), product_sizes(size_name)')
        .eq('order_id', activeOrderId);
      if (itemsErr) throw itemsErr;
      const mapped = (items || []).map((it: any) => ({
        id: it.id,
        name: it.products?.name || 'Producto',
        size: it.product_sizes?.size_name || undefined,
        quantity: it.quantity,
        price: typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : (it.unit_price || 0),
        subtotal: typeof it.subtotal === 'string' ? parseFloat(it.subtotal) : (it.subtotal || 0),
        notes: it.notes || undefined,
      }));
      setExistingItems(mapped);
    } catch (err) {
      console.error('Error cargando contenido de pedido activo:', err);
      toast.error('No se pudo cargar el contenido del pedido activo');
    }
  }, [activeOrderId, tableId, setTableId, setServiceType]);

  useEffect(() => {
    loadActiveOrderContent();
  }, [loadActiveOrderContent]);

  // Quitar un producto existente del pedido activo
  const handleDeleteExistingItem = async (itemId: string) => {
    if (!activeOrderId) return;
    if (profile?.role === 'waiter') {
      toast.error(t('Los camareros no pueden eliminar productos de un pedido existente'));
      return;
    }
    try {
      const { error: delError } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);
      if (delError) throw delError;

      const updatedItems = existingItems.filter(it => it.id !== itemId);
      const newTotal = updatedItems.reduce((sum, it) => sum + it.subtotal, 0);

      const { error: updateErr } = await supabase
        .from('orders')
        .update({ total: newTotal })
        .eq('id', activeOrderId);
      if (updateErr) throw updateErr;

      setExistingItems(updatedItems);
      setExistingOrderTotal(newTotal);
      toast.success(t('Producto eliminado del pedido'));
    } catch (err) {
      console.error('Error al eliminar producto del pedido:', err);
      toast.error(t('Error al eliminar producto'));
    }
  };

  // Modificar cantidad (+ / -) de un producto existente del pedido activo
  const handleUpdateExistingItemQuantity = async (itemId: string, delta: number) => {
    if (!activeOrderId) return;
    if (delta < 0 && profile?.role === 'waiter') {
      toast.error(t('Los camareros no pueden reducir la cantidad de productos de un pedido existente'));
      return;
    }
    const item = existingItems.find(it => it.id === itemId);
    if (!item) return;

    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      await handleDeleteExistingItem(itemId);
      return;
    }

    try {
      const newSubtotal = newQuantity * item.price;
      const { error: updateItemErr } = await supabase
        .from('order_items')
        .update({
          quantity: newQuantity,
          subtotal: newSubtotal
        })
        .eq('id', itemId);
      if (updateItemErr) throw updateItemErr;

      const updatedItems = existingItems.map(it =>
        it.id === itemId ? { ...it, quantity: newQuantity, subtotal: newSubtotal } : it
      );
      const newTotal = updatedItems.reduce((sum, it) => sum + it.subtotal, 0);

      const { error: updateOrderErr } = await supabase
        .from('orders')
        .update({ total: newTotal })
        .eq('id', activeOrderId);
      if (updateOrderErr) throw updateOrderErr;

      setExistingItems(updatedItems);
      setExistingOrderTotal(newTotal);
    } catch (err) {
      console.error('Error al actualizar cantidad:', err);
      toast.error(t('Error al actualizar cantidad'));
    }
  };

  // Cancelar completamente el pedido activo
  const handleCancelActiveOrder = async () => {
    if (!activeOrderId) return;
    if (profile?.role === 'waiter') {
      toast.error(t('Los camareros no pueden cancelar o eliminar un pedido existente'));
      return;
    }
    if (!window.confirm(t('¿Seguro que deseas cancelar este pedido?'))) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', activeOrderId);
      if (error) throw error;

      if (tableId) {
        await updateTableStatus(tableId, 'available');
      }
      setActiveOrderId(null);
      setTableId(null);
      setServiceType('takeaway');
      clearCart();
      toast.success(t('Pedido cancelado'));
    } catch (err) {
      console.error('Error al cancelar pedido:', err);
      toast.error(t('Error al cancelar pedido'));
    }
  };

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
    await fetchProducts();
  };

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*, categories(preparation_zone)')
        .eq('available', true)
        .order('name');

      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      // Fetch all products without pagination
      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setProducts(data);
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

  // Removed handleLoadMore - no longer needed

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
        product: ci.product,
        notes: ci.notes
      }));

      // helpers están definidos fuera

      if (!activeOrderId) {
        // Crear nueva orden como pendiente (sin payment_method todavía)
        const { data: order, error: orderError } = await supabase
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
          paymentMethod: 'En attente',
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
          total: deltaTotal, // Muestra solo el total añadido
          paymentMethod: 'En attente',
          cashierName: (user.user_metadata as any)?.full_name || user.email || 'Usuario',
        };

        setPendingOrderData(ticketData);
        setShowValidationModal(true);

        if (existingOrder.table_id) {
          await updateTableStatus(existingOrder.table_id, 'occupied');
        }

        // Refrescar contenido del pedido activo tras añadir
        setExistingOrderTotal(newTotal);
        await loadActiveOrderContent();
        clearCart();
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

  const handleSendToPreparation = async () => {
    if (!pendingOrderData) return;

    try {
      const orderNum = pendingOrderData.orderNumber;
      
      // Enviar a spooler de cocina
      await enqueuePrintJob(activeOrderId, 'kitchen', {
        orderNum,
        cartItems: pendingOrderData.items,
        tableId,
        serviceType
      });

      // Enviar a spooler de cliente/caja (2 copias)
      const printPayload = {
        ticketData: {
          ...pendingOrderData,
          paymentMethod: 'En attente'
        }
      };
      
      await enqueuePrintJob(activeOrderId, 'invoice', printPayload);
      await enqueuePrintJob(activeOrderId, 'invoice', printPayload);

      // 3. Si hay mesa, asegurar que el estado quede como 'occupied' en Sala
      if (tableId) {
        await updateTableStatus(tableId, 'occupied');
      }

      // 4. Resetear estados tras enviar a preparación
      setShowValidationModal(false);
      setPendingOrderData(null);

      setActiveOrderId(null);
      setTableId(null);
      setServiceType('takeaway');
      setPaymentMethod(null);
      clearCart();

      toast.success(t('¡Pedido enviado a preparación e impreso!'));
    } catch (err) {
      console.error('Error al enviar a preparación:', err);
      toast.error(t('Error al enviar a preparación'));
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

      // Imprimir comandas por zona (Kitchen Routing)
      await enqueuePrintJob(activeOrderId, 'kitchen', {
        orderNum: updatedTicketData.orderNumber,
        cartItems: pendingOrderData.items,
        tableId,
        serviceType
      });

      // Imprimir ticket de cobro final con todos los productos del pedido acumulado
      const { data: fullOrder } = await supabase
        .from('orders')
        .select(`
          total,
          created_at,
          order_number,
          order_items (quantity, unit_price, products(name), product_sizes(size_name))
        `)
        .eq('id', activeOrderId)
        .single();
        
      if (fullOrder) {
        const fullItems = fullOrder.order_items.map((i: any) => ({
          name: Array.isArray(i.products) ? i.products[0]?.name : i.products?.name,
          size: Array.isArray(i.product_sizes) ? i.product_sizes[0]?.size_name : i.product_sizes?.size_name,
          quantity: i.quantity,
          price: i.unit_price,
        }));
        
        const fullTicketData = {
          ...updatedTicketData,
          items: fullItems,
          total: typeof fullOrder.total === 'string' ? parseFloat(fullOrder.total) : fullOrder.total,
          orderDate: new Date(fullOrder.created_at)
        };
        // 2 COPIAS DEL TICKET FINAL
        await enqueuePrintJob(activeOrderId, 'receipt', { ticketData: fullTicketData });
        await enqueuePrintJob(activeOrderId, 'receipt', { ticketData: fullTicketData });
      } else {
        // 2 COPIAS DEL TICKET FINAL
        await enqueuePrintJob(activeOrderId, 'receipt', { ticketData: updatedTicketData });
        await enqueuePrintJob(activeOrderId, 'receipt', { ticketData: updatedTicketData });
      }

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
      {/* Banner de Pedido Activo en móvil */}
      {activeOrderId && (
        <div className="bg-amber-600 text-white px-3 py-2 flex justify-between items-center text-xs shadow-sm">
          <div>
            <span className="font-black">
              #{existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-6)}
            </span>
            <span className="ml-2 font-medium opacity-95">Total: <b>{formatCurrency(existingOrderTotal)}</b> ({existingItems.length} items)</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowMobileActiveModal(true)}
              className="bg-white text-amber-900 font-bold px-2 py-1 rounded shadow-xs text-xs"
            >
              Editar Pedido
            </button>
            <button
              onClick={() => {
                setActiveOrderId(null);
                setTableId(null);
                setServiceType('takeaway');
                clearCart();
              }}
              className="bg-amber-700/80 hover:bg-amber-800 text-white px-2 py-1 rounded text-xs"
              title="Cerrar edición"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Sección de Categorías y Selector de Columnas Móvil */}
      <div className="bg-white border-b border-gray-200 px-2 py-2.5 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollCategoryLeft(mobileCategoryScrollRef)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex-shrink-0 transition-colors"
            title="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={mobileCategoryScrollRef}
            onWheel={handleCategoryWheel}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin flex-1 select-none touch-pan-x"
          >
            <button
              data-cat-id="all"
              onClick={() => {
                setSelectedCategory('all');
                scrollToCategoryPill('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${selectedCategory === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
            >
              {t('Todos')}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                data-cat-id={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  scrollToCategoryPill(cat.id);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollCategoryRight(mobileCategoryScrollRef)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex-shrink-0 transition-colors"
            title="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de productos móvil - Grid Cuadrada 2 por fila (Con soporte para deslizar izquierda/derecha) */}
      <div
        onTouchStart={handleMobileTouchStart}
        onTouchEnd={handleMobileTouchEnd}
        className="flex-1 overflow-y-auto p-2 bg-gray-50 touch-pan-y"
      >
        <div className="grid grid-cols-2 gap-2.5">
          {products.map(product => {
            const productSizesList = productSizes(product.id);
            const totalInCart = cart
              .filter(item => item.product.id === product.id)
              .reduce((sum, item) => sum + item.quantity, 0);

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (productSizesList.length === 0) {
                    addItem(product);
                  }
                }}
                className={`bg-white rounded-2xl p-2.5 shadow-xs border-2 transition-all flex flex-col justify-between relative overflow-hidden select-none active:scale-95 cursor-pointer ${
                  totalInCart > 0 ? 'border-amber-500 bg-amber-50/30' : 'border-gray-200 hover:border-amber-400'
                }`}
              >
                {/* Badge de cantidad agregada al carrito o icono + */}
                {totalInCart > 0 ? (
                  <div className="absolute top-1.5 right-1.5 z-10 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-md animate-in zoom-in duration-150">
                    x{totalInCart}
                  </div>
                ) : (
                  productSizesList.length === 0 && (
                    <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <Plus className="w-3 h-3" />
                    </div>
                  )
                )}

                {/* Encabezado: Imagen o Icono + Nombre */}
                <div className="flex flex-col items-center">
                  {product.image_url && product.image_url.length > 0 ? (
                    <div className="relative w-full h-16 sm:h-20 bg-gray-100 rounded-xl overflow-hidden mb-1.5">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-10 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl flex items-center justify-center mb-1.5">
                      <Coffee className="w-5 h-5 text-amber-500/70" />
                    </div>
                  )}

                  <h3 className="font-extrabold text-gray-900 text-xs sm:text-sm leading-snug line-clamp-2 text-center min-h-[2rem] flex items-center justify-center">
                    {product.name}
                  </h3>
                </div>

                {/* Pie: Precio y Tamaños si existen */}
                <div className="mt-1.5 pt-1 border-t border-gray-100 text-center">
                  <p className="font-black text-amber-600 text-xs sm:text-sm">
                    {formatCurrency(product.base_price)}
                  </p>

                  {productSizesList.length > 0 && (
                    <div className="space-y-1 mt-1.5">
                      {productSizesList.map(size => (
                        <button
                          key={size.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem(product, size);
                          }}
                          className="w-full bg-amber-50 hover:bg-amber-100 text-amber-900 py-1 px-1 rounded-lg text-[10px] font-bold border border-amber-200 flex justify-between items-center active:scale-95 transition-transform"
                        >
                          <span className="truncate">{size.size_name}</span>
                          <span className="font-black text-amber-700 ml-0.5">+{formatCurrency(size.price_modifier)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
            className={`py-2 px-3 rounded-lg text-sm font-medium ${serviceType === 'takeaway' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
          >
            {t('Para llevar')}
          </button>
          <button
            onClick={() => setServiceType('dine_in')}
            className={`py-2 px-3 rounded-lg text-sm font-medium ${serviceType === 'dine_in' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
          >
            {t('En sala')}
          </button>
        </div>

        {serviceType === 'dine_in' && (
          <select
            value={tableId || ''}
            onChange={(e) => setTableId(e.target.value || null)}
            disabled={!!activeOrderId}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm disabled:bg-gray-100 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <option value="">{t('Seleccione mesa')}</option>
            {tables.map(t => (
              <option key={t.id} value={t.id} disabled={!activeOrderId && t.status !== 'available' && t.id !== tableId}>
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
            onClick={() => setShowMobileCartModal(true)}
            className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium"
          >
            Ver Carrito Detallado ({cart.length})
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

      {/* Modal de Pedido Activo en Móvil */}
      {showMobileActiveModal && activeOrderId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:hidden">
          <div className="bg-white w-full max-h-[85vh] rounded-t-3xl p-4 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center pb-3 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  Pedido #{existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-8)}
                </h3>
                <p className="text-xs text-amber-700 font-bold">
                  Total: {formatCurrency(existingOrderTotal)} ({existingItems.length} productos)
                </p>
              </div>
              <button
                onClick={() => setShowMobileActiveModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {existingItems.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-6">Sin productos en este pedido.</p>
              ) : (
                existingItems.map((it) => (
                  <div key={it.id} className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{it.name}{it.size ? ` (${it.size})` : ''}</h4>
                        <p className="text-xs text-gray-500">c/u {formatCurrency(it.price)}</p>
                      </div>
                      {profile?.role !== 'waiter' && (
                        <button
                          onClick={() => handleDeleteExistingItem(it.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200/60">
                      <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-amber-200">
                        {profile?.role !== 'waiter' && (
                          <button
                            onClick={() => handleUpdateExistingItemQuantity(it.id, -1)}
                            className="w-7 h-7 rounded bg-amber-100 flex items-center justify-center text-amber-800 font-bold"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="w-6 text-center font-bold text-sm text-gray-900">{it.quantity}</span>
                        <button
                          onClick={() => handleUpdateExistingItemQuantity(it.id, 1)}
                          className="w-7 h-7 rounded bg-amber-100 flex items-center justify-center text-amber-800 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-black text-amber-800 text-sm">
                        {formatCurrency(it.subtotal)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t space-y-2">
              <button
                onClick={() => {
                  setShowMobileActiveModal(false);
                  const ticketData = {
                    orderDate: new Date(),
                    orderNumber: existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-8),
                    items: existingItems,
                    total: existingOrderTotal,
                    paymentMethod: 'En attente',
                    cashierName: user ? ((user.user_metadata as any)?.full_name || user.email || 'Usuario') : 'Usuario',
                  };
                  setPendingOrderData(ticketData);
                  setShowValidationModal(true);
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl shadow-md text-sm"
              >
                Validar y Cobrar
              </button>
              <button
                onClick={() => setShowMobileActiveModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Notas para el carrito */}
      {noteModalIndex !== null && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-gray-900 text-lg mb-4">
              Ajouter une note à {cart[noteModalIndex]?.product?.name}
            </h3>

            <textarea
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 outline-none resize-none mb-4"
              rows={3}
              placeholder="Écrire des instructions spéciales pour la cuisine..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setNoteModalIndex(null); setNoteText(''); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { 
                  setItemNotes(noteModalIndex, noteText); 
                  setNoteModalIndex(null); 
                  setNoteText(''); 
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-md"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carrito Borrador en Móvil */}
      {showMobileCartModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:hidden">
          <div className="bg-white w-full max-h-[85vh] rounded-t-3xl p-4 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center pb-3 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  {t('Carrito')} ({cart.length} items)
                </h3>
                <p className="text-xs text-amber-600 font-bold">
                  {t('Total:')} {formatCurrency(total)}
                </p>
              </div>
              <button
                onClick={() => setShowMobileCartModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-6">{t('El carrito está vacío')}</p>
              ) : (
                cart.slice().reverse().map((item, index) => {
                  const actualIdx = cart.length - 1 - index;
                  const itemUnitPrice = item.product.base_price + (item.size?.price_modifier || 0);
                  const itemSubtotal = itemUnitPrice * item.quantity;
                  return (
                    <div key={actualIdx} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">
                            {item.quantity}x {item.product.name}{item.size ? ` (${item.size.size_name})` : ''}
                          </h4>
                          <p className="text-xs text-gray-500">c/u {formatCurrency(itemUnitPrice)}</p>
                          {item.notes && <p className="text-[11px] text-amber-600 font-bold italic mt-0.5">Nota: {item.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setNoteModalIndex(actualIdx); setNoteText(item.notes || ''); }}
                            className="text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-colors"
                            title="Añadir nota"
                          >
                            <span className="text-sm">📝</span>
                          </button>
                          <button
                            onClick={() => removeItem(actualIdx)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                            title={t('Eliminar producto')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2 bg-amber-50/60 rounded-lg p-1 border border-amber-200">
                          <button
                            onClick={() => updateQuantity(actualIdx, -1)}
                            className="w-7 h-7 rounded bg-white border border-amber-300 flex items-center justify-center text-amber-800 font-bold"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm text-amber-950">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(actualIdx, 1)}
                            className="w-7 h-7 rounded bg-white border border-amber-300 flex items-center justify-center text-amber-800 font-bold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="font-black text-amber-700 text-sm">
                          {formatCurrency(itemSubtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t">
              <button
                onClick={() => setShowMobileCartModal(false)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl shadow-md text-sm"
              >
                {t('Listo')} ({formatCurrency(total)})
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* Sección de Categorías - Desktop */}
          <div className="bg-white border-b border-gray-200">
            <div className="w-full px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollCategoryLeft(categoryScrollRef)}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex-shrink-0 transition-colors"
                  title="Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div
                  ref={categoryScrollRef}
                  onWheel={handleCategoryWheel}
                  className="flex items-center gap-3 overflow-x-auto pb-1.5 flex-1 scrollbar-thin select-none touch-pan-x"
                >
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`flex-shrink-0 px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 ${selectedCategory === 'all'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                      }`}
                  >
                    {t('Todos')}
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex-shrink-0 px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 ${selectedCategory === cat.id
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                        }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => scrollCategoryRight(categoryScrollRef)}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex-shrink-0 transition-colors"
                  title="Siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
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

            {/* Removed "Load More" button - all products now shown by default */}
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
            <div className="px-3 pt-3 pb-3 border-b-2 border-amber-200 bg-amber-50/40">
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <h3 className="text-sm font-bold text-gray-900">
                      Pedido #{existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-8)}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Total actual: <span className="font-bold text-amber-700">{formatCurrency(existingOrderTotal)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    onClick={() => {
                      const ticketData = {
                        orderDate: new Date(),
                        orderNumber: existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-8),
                        items: existingItems,
                        total: existingOrderTotal,
                        paymentMethod: 'En attente',
                        cashierName: user ? ((user.user_metadata as any)?.full_name || user.email || 'Usuario') : 'Usuario',
                      };
                      setPendingOrderData(ticketData);
                      setShowValidationModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white transition-colors hover:bg-amber-700 shadow-xs"
                  >
                    Validar
                  </button>
                  <button
                    onClick={() => {
                      setActiveOrderId(null);
                      setTableId(null);
                      setServiceType('takeaway');
                      clearCart();
                      toast.success(t('Edición cerrada'));
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold bg-white hover:bg-gray-50 border-gray-300 text-gray-700 transition-colors shadow-xs"
                    title={t('Cerrar edición de este pedido')}
                  >
                    {t('Cerrar')}
                  </button>
                  {profile?.role !== 'waiter' && (
                    <button
                      onClick={handleCancelActiveOrder}
                      className="p-1.5 rounded-lg border text-xs bg-white hover:bg-red-50 border-red-200 text-red-600 transition-colors shadow-xs"
                      title={t('Cancelar todo el pedido')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de productos actuales editables */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 scrollbar-thin">
                {existingItems.length === 0 ? (
                  <div className="bg-white rounded-xl p-3 text-center border border-amber-200/60">
                    <p className="text-xs text-gray-500 font-medium">{t('Sin productos en este pedido.')}</p>
                    <p className="text-[11px] text-amber-600 mt-1">{t('Añade nuevos productos desde el menú a la izquierda.')}</p>
                  </div>
                ) : (
                  existingItems.map((it) => (
                    <div key={it.id} className="bg-white border border-amber-200/70 rounded-xl p-2.5 shadow-xs hover:border-amber-300 transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-900 font-bold leading-tight truncate">
                            {it.name}{it.size ? ` (${it.size})` : ''}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                            c/u {formatCurrency(it.price)}
                          </div>
                          {it.notes && <div className="text-[11px] text-amber-600 font-bold italic mt-0.5">Nota: {it.notes}</div>}
                        </div>
                        {profile?.role !== 'waiter' && (
                          <button
                            onClick={() => handleDeleteExistingItem(it.id)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors flex-shrink-0"
                            title={t('Eliminar producto')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
                        <div className="flex items-center gap-1 bg-amber-50/60 rounded-lg p-0.5 border border-amber-200">
                          {profile?.role !== 'waiter' && (
                            <button
                              onClick={() => handleUpdateExistingItemQuantity(it.id, -1)}
                              className="w-5 h-5 rounded bg-white flex items-center justify-center hover:bg-amber-100 text-amber-800 transition-colors font-bold shadow-2xs"
                              title="Disminuir"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                          <span className="w-6 text-center font-bold text-xs text-amber-950">{it.quantity}</span>
                          <button
                            onClick={() => handleUpdateExistingItemQuantity(it.id, 1)}
                            className="w-5 h-5 rounded bg-white flex items-center justify-center hover:bg-amber-100 text-amber-800 transition-colors font-bold shadow-2xs"
                            title="Aumentar"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {formatCurrency(it.subtotal)}
                        </span>
                      </div>
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
                        {item.notes && <p className="text-[11px] text-amber-600 font-bold italic mt-1">Nota: {item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setNoteModalIndex(cart.length - 1 - index); setNoteText(item.notes || ''); }}
                          className="text-amber-600 hover:text-white hover:bg-amber-500 p-2 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Añadir nota"
                        >
                          📝
                        </button>
                        <button
                          onClick={() => removeItem(cart.length - 1 - index)}
                          className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
              <label className="block text-xs font-medium text-gray-700 mb-2">{t('Servicio')}</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setServiceType('takeaway')}
                  className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${serviceType === 'takeaway' ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {t('Para llevar')}
                </button>
                <button
                  onClick={() => setServiceType('dine_in')}
                  className={`p-2 rounded-lg border-2 bg-white transition-colors text-xs ${serviceType === 'dine_in' ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {t('En sala')}
                </button>
              </div>
              {serviceType === 'dine_in' && (
                <div className="flex gap-2 items-center">
                  <select
                    value={tableId || ''}
                    onChange={(e) => setTableId(e.target.value || null)}
                    disabled={!!activeOrderId}
                    className="flex-1 px-2 py-2 rounded-lg border-2 bg-white text-sm disabled:bg-gray-100 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="">Seleccione mesa</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id} disabled={!activeOrderId && t.status !== 'available' && t.id !== tableId}>
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
                  <span className="font-bold text-gray-800 text-sm">{t('Total de la Commande :')}</span>
                  <span className="font-black text-3xl bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {formatCurrency(pendingOrderData.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-amber-300">
                  <span className="font-bold text-gray-800 text-sm">{t('Mode de paiement :')}</span>
                  <span className="font-bold text-amber-700 bg-white/60 px-3 py-1 rounded-lg">
                    {pendingOrderData.paymentMethod}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <span className="font-bold text-blue-800">ℹ️ {t('Información:')}</span><br />
                {profile?.role === 'waiter'
                  ? t('Haga clic en Préparer para enviar la comanda a preparación e imprimir en cocina/barra.')
                  : t('Seleccione la acción requerida para este pedido.')}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              {profile?.role === 'waiter' ? (
                /* Para camareros: ÚNICO botón Préparer */
                <button
                  onClick={handleSendToPreparation}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl transition-all font-black text-lg shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <span>👨‍🍳</span>
                  <span>{t('Préparer')}</span>
                </button>
              ) : (
                /* Para cajeros y administradores */
                <>
                  <button
                    onClick={handleSendToPreparation}
                    className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all font-bold shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <span>👨‍🍳</span>
                    <span>{t('Préparer')}</span>
                  </button>
                  <button
                    onClick={handleValidateAndPrint}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <span>💳</span>
                    <span>{t('Valider et Imprimer')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

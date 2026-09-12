import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { printKitchenRouting, printMainTicket, isOrderPrintedLocally } from '../lib/printerService';

export function PrintServer() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const processedOrders = useRef<Set<string>>(new Set());
  const processedCompletedOrders = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Verificar si somos el servidor de impresión
    const isPrintServer = localStorage.getItem('print_server_active') === 'true';
    if (!isPrintServer) return;

    console.log('🖨️ MODO SERVIDOR DE IMPRESIÓN ACTIVO: Escuchando nuevos pedidos...');

    const loadCompanyInfo = async () => {
      try {
        const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
        return data || { company_name: 'Restaurante' };
      } catch {
        return { company_name: 'Restaurante' };
      }
    };

    const loadDependencies = async () => {
      const [{ data: categories }, { data: tables }] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('tables').select('*')
      ]);
      return { categories: categories || [], tables: tables || [] };
    };

    const fetchOrderDetails = async (orderId: string) => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            product_id,
            size_id,
            notes,
            products!product_id (
              name,
              category_id
            ),
            product_sizes!size_id (
              size_name
            )
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order details for Print Server:', error);
        return null;
      }

      if (data && data.employee_id) {
        try {
          const { data: emp } = await supabase
            .from('employee_profiles')
            .select('full_name')
            .eq('id', data.employee_id)
            .maybeSingle();
          if (emp) {
            data.employee_profiles = emp;
          }
        } catch {
          // ignore
        }
      }

      return data;
    };

    const handleNewOrder = async (orderId: string) => {
      if (isOrderPrintedLocally(orderId, 'kitchen')) {
        console.log('ℹ️ PrintServer: Orden ya impresa localmente en este TPV. Omitiendo duplicado.');
        return;
      }

      if (processedOrders.current.has(orderId)) return;
      processedOrders.current.add(orderId);

      try {
        // Margen de 600ms para permitir que los order_items se inserten en la BD
        await new Promise(r => setTimeout(r, 600));

        let orderData = await fetchOrderDetails(orderId);
        // Si no tiene items todavía, reintentar una vez
        if (orderData && (!orderData.order_items || orderData.order_items.length === 0)) {
          console.log('⏳ PrintServer: Esperando inserción de artículos de la orden...');
          await new Promise(r => setTimeout(r, 800));
          orderData = await fetchOrderDetails(orderId);
        }

        if (!orderData || !orderData.order_items || orderData.order_items.length === 0) {
          console.warn('⚠️ PrintServer: Orden sin artículos o no encontrada:', orderId);
          return;
        }

        const deps = await loadDependencies();

        const orderNum = orderData.order_number
          ? `#${orderData.order_number.toString().padStart(3, '0')}`
          : `#${orderData.id.slice(-3).toUpperCase()}`;

        console.log(`🖨️ PrintServer: Enviando a cocina orden ${orderNum} (${orderData.order_items.length} artículos)`);
        await printKitchenRouting({
          orderNum,
          cartItems: orderData.order_items,
          categories: deps.categories,
          tables: deps.tables,
          tableId: orderData.table_id,
          serviceType: orderData.service_type || 'takeaway'
        });
      } catch (err) {
        console.error('❌ PrintServer: Error procesando comanda de cocina:', err);
      }
    };

    const handleCompletedOrder = async (orderId: string) => {
      if (isOrderPrintedLocally(orderId, 'invoice')) {
        console.log('ℹ️ PrintServer: Factura ya impresa localmente en este TPV. Omitiendo duplicado.');
        return;
      }

      if (processedCompletedOrders.current.has(orderId)) return;
      processedCompletedOrders.current.add(orderId);

      try {
        const orderData = await fetchOrderDetails(orderId);
        if (!orderData) return;

        const companyInfo = await loadCompanyInfo();

        const orderNum = orderData.order_number
          ? `#${orderData.order_number.toString().padStart(3, '0')}`
          : `#${orderData.id.slice(-3).toUpperCase()}`;

        let paymentMethodStr = 'Efectivo';
        if (orderData.payment_method === 'card') paymentMethodStr = 'Tarjeta';
        else if (orderData.payment_method === 'digital') paymentMethodStr = 'Digital';

        const ticketData = {
          orderNumber: orderNum,
          orderDate: new Date(orderData.updated_at || orderData.created_at),
          items: orderData.order_items,
          total: orderData.total,
          paymentMethod: paymentMethodStr,
          cashierName: orderData.employee_profiles?.full_name || 'Cajero'
        };

        console.log(`🖨️ PrintServer: Imprimiendo ticket de cliente para orden ${orderNum}`);
        await printMainTicket({
          ticketData,
          companyInfo,
          formatCurrency,
          t
        });
      } catch (err) {
        console.error('❌ PrintServer: Error procesando factura:', err);
      }
    };

    const channel = supabase.channel('print_server_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        console.log('🔔 PrintServer: Evento INSERT recibido:', payload.new?.id, payload.new?.status);
        const newOrder = payload.new;
        if (newOrder?.status === 'preparing') {
          handleNewOrder(newOrder.id);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        console.log('🔔 PrintServer: Evento UPDATE recibido:', payload.new?.id, payload.new?.status);
        const newOrder = payload.new;
        const oldOrder = payload.old;

        if (newOrder?.status === 'preparing' && oldOrder?.status !== 'preparing') {
          handleNewOrder(newOrder.id);
        }

        if (newOrder?.status === 'completed' && oldOrder?.status !== 'completed') {
          handleCompletedOrder(newOrder.id);
        }
      })
      .subscribe((status) => {
        console.log('📡 PrintServer: Estado de suscripción Realtime:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [formatCurrency, t]);

  return null; // Componente invisible
}


import { qzService } from './qzTray';

export interface KitchenPrintParams {
  orderNum: string;
  cartItems: any[];
  categories: any[];
  tables: any[];
  tableId: string | null;
  serviceType: string;
}

export const printKitchenRouting = async (params: KitchenPrintParams) => {
  const { orderNum, cartItems, categories, tables, tableId, serviceType } = params;
  
  try {
    const tableName = tableId ? (tables.find(t => t.id === tableId)?.name || '') : '';
    const zones = new Map<string, any[]>();

    cartItems.forEach(cartItem => {
      // Support both cart item format and db order_items format (which might return an array for products)
      const rawProduct = cartItem.product || cartItem.products;
      const product = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct;
      
      const categoryId = product?.category_id;
      const rawZone = categories.find(c => c.id === categoryId)?.preparation_zone;
      
      // 'none' = sin impresora, se omite este artículo del routing
      if (rawZone === 'none') return;
      
      const zone = (rawZone && rawZone.trim() !== '') ? rawZone.trim() : '';
      if (!zones.has(zone)) zones.set(zone, []);
      zones.get(zone)!.push(cartItem);
    });

    for (const [zone, items] of zones.entries()) {
      const zoneTitle = zone ? zone.toUpperCase() : 'COMANDA COCINA';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Comanda ${zoneTitle}</title>
            <style>
               @page { margin: 0; }
               body {
                 font-family: 'Courier New', Courier, monospace, sans-serif;
                 width: 76mm;
                 max-width: 76mm;
                 margin: 0 auto;
                 padding: 8px 4px;
                 color: #000;
                 background: #fff;
                 font-size: 13px;
                 line-height: 1.25;
               }
               .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
               .header h1 { font-size: 20px; font-weight: 900; margin: 2px 0; text-transform: uppercase; }
               .header .meta { font-size: 13px; font-weight: bold; margin: 2px 0; }
               .badge { display: inline-block; font-size: 16px; font-weight: 900; border: 2px solid #000; padding: 2px 8px; margin-top: 4px; }
               .items { margin: 8px 0; }
               .item-row { display: flex; align-items: flex-start; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dotted #888; }
               .qty { font-size: 18px; font-weight: 900; min-width: 32px; }
               .name { font-size: 15px; font-weight: 700; flex: 1; word-break: break-word; }
               .notes { font-size: 12px; font-style: italic; margin-top: 2px; }
               .footer { text-align: center; border-top: 2px dashed #000; padding-top: 6px; margin-top: 8px; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${zoneTitle}</h1>
              <div class="badge">#${orderNum}</div>
              <div class="meta" style="margin-top: 4px;">
                ${serviceType === 'dine_in' ? '🍽️ MESA: ' + (tableName || 'Sin mesa') : '🥡 PARA LLEVAR'}
              </div>
              <div class="meta" style="font-size: 11px; font-weight: normal; color: #333;">
                ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}
              </div>
            </div>

            <div class="items">
              ${items.map(i => {
                const rawProduct = i.product || i.products;
                const prod = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct;
                const productName = prod?.name || '';
                
                const rawSize = i.size || i.product_sizes;
                const size = Array.isArray(rawSize) ? rawSize[0] : rawSize;
                const sizeName = size?.size_name || '';
                return `
                <div class="item-row">
                  <div class="qty">${i.quantity}x</div>
                  <div class="name">
                    ${productName}
                    ${sizeName ? `<span style="font-weight: normal;"> (${sizeName})</span>` : ''}
                  </div>
                </div>
                `;
              }).join('')}
            </div>

            <div class="footer">
              TOTAL ARTÍCULOS: ${items.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          </body>
        </html>
      `;

      console.log(`🖨️ KITCHEN ROUTING: Enviando ticket a zona/impresora "${zone || 'Default'}"...`);
      await qzService.printHTML(zone, html);
    }
  } catch (err) {
    console.error('Error procesando Kitchen Routing:', err);
  }
};

export interface TicketPrintParams {
  ticketData: any;
  companyInfo: any;
  formatCurrency: (amount: number) => string;
  t: (key: string) => string;
}

export const printMainTicket = async (params: TicketPrintParams) => {
  const { ticketData, companyInfo, formatCurrency, t } = params;

  if (!ticketData || !ticketData.items) {
    console.error('❌ TICKET: Datos inválidos, cancelando impresión');
    return;
  }

  try {
    const printContent = `
      <div class="ticket">
        <div class="header">
          <h1>☕ ${companyInfo.company_name || 'Restaurante'}</h1>
          ${companyInfo.address ? `<p>${companyInfo.address}</p>` : ''}
          ${companyInfo.phone ? `<p>Tel: ${companyInfo.phone}</p>` : ''}
          <p>${t('ticket.title') || 'Ticket de Venta'}</p>
        </div>

        <div class="ticket-info">
          <div><strong>Ticket:</strong> ${ticketData.orderNumber}</div>
          <div><strong>Date:</strong> ${new Date(ticketData.orderDate || new Date()).toLocaleDateString('es-ES')}</div>
          <div><strong>Heure :</strong> ${new Date(ticketData.orderDate || new Date()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          <div><strong>Caissier :</strong> ${ticketData.cashierName || 'Cajero'}</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 15%">Qte</th>
              <th style="width: 50%">Produit</th>
              <th style="width: 15%">P.U.</th>
              <th style="width: 20%; text-align: right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${ticketData.items.map((item: any) => {
              const rawProduct = item.product || item.products;
              const prod = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct;
              const productName = prod?.name || '';
              
              const rawSize = item.size || item.product_sizes;
              const size = Array.isArray(rawSize) ? rawSize[0] : rawSize;
              const sizeName = size?.size_name || '';
              
              const displayName = sizeName ? `${productName} (${sizeName})` : productName;
              const price = item.price || item.unit_price || 0;
              const subtotal = price * item.quantity;
              
              return `
              <tr>
                <td style="vertical-align: top">${item.quantity}</td>
                <td style="vertical-align: top">${displayName}</td>
                <td style="vertical-align: top">${formatCurrency(price)}</td>
                <td style="vertical-align: top; text-align: right">${formatCurrency(subtotal)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>TOTAL:</span>
            <span>${formatCurrency(ticketData.total || 0)}</span>
          </div>
        </div>

        <div class="ticket-info" style="margin-top: 6px">
          <div>Paiement : ${ticketData.paymentMethod || 'Efectivo'}</div>
        </div>

        <div class="footer">
          <div class="thanks">${t('ticket.thanks') || '¡Gracias por su compra!'}</div>
          <div>${new Date(ticketData.orderDate || new Date()).toLocaleDateString('es-ES')}</div>
          <div>${companyInfo.company_name || 'Restaurante'}</div>
        </div>
      </div>
    `;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t('ticket.title') || 'Ticket'}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    body { font-family: 'Courier New', monospace; padding: 4px; font-size: 12px; line-height: 1.2; }
    .ticket { width: 76mm; max-width: 76mm; margin: 0 auto; padding: 2px 2px 6px 2px; background: white; }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
    .header h1 { margin: 0; font-size: 16px; font-weight: bold; }
    .header p { margin: 1px 0; font-size: 10px; }
    .ticket-info { margin-bottom: 6px; font-size: 11px; }
    .ticket-info div { margin-bottom: 1px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11px; }
    .items-table th, .items-table td { padding: 2px 1px; text-align: left; border-bottom: 1px dotted #ccc; }
    .items-table th { font-weight: bold; border-bottom: 1px solid #000; }
    .total-section { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; font-weight: bold; font-size: 12px; }
    .footer { text-align: center; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000; font-size: 9px; color: #444; }
    .thanks { margin: 4px 0; font-weight: bold; font-size: 10px; text-align: center; }
  </style>
</head>
<body>${printContent}</body>
</html>`;

    const printed = await qzService.printHTML('', fullHtml, true);
    if (printed) {
      console.log('✅ TICKET: Printed silently via QZ Tray');
      window.dispatchEvent(new CustomEvent('ticketPrinted'));
    }
  } catch (err) {
    console.warn('⚠️ TICKET: Error imprimiendo ticket principal:', err);
    window.dispatchEvent(new CustomEvent('ticketPrinted'));
  }
};

export const markOrderPrintedLocally = (orderId: string, type: 'kitchen' | 'invoice') => {
  if (typeof window !== 'undefined') {
    if (!(window as any).__localPrintedOrders) {
      (window as any).__localPrintedOrders = new Set<string>();
    }
    const key = `${type}_${orderId}`;
    (window as any).__localPrintedOrders.add(key);
    console.log(`📌 Registrado pedido como impreso localmente [${key}]`);
    setTimeout(() => {
      (window as any).__localPrintedOrders?.delete(key);
    }, 5 * 60 * 1000);
  }
};

export const isOrderPrintedLocally = (orderId: string, type: 'kitchen' | 'invoice'): boolean => {
  if (typeof window !== 'undefined' && (window as any).__localPrintedOrders) {
    const key = `${type}_${orderId}`;
    return (window as any).__localPrintedOrders.has(key);
  }
  return false;
};


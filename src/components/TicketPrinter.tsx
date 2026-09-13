import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { qzService, isMobileDevice } from '../lib/qzTray';
import { markOrderPrintedLocally } from '../lib/printerService';

// Add a function to refresh company info that can be called from outside
export const refreshCompanyInfo = async () => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('company_name, address, phone')
      .single();

    if (error) {
      console.error('Error refreshing company info:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error refreshing company info:', err);
    return null;
  }
};

interface TicketProps {
  orderDate: Date;
  orderNumber: string;
  items: Array<{
    name: string;
    size?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  paymentMethod: string;
  cashierName: string;
  autoPrint?: boolean;
  hideButton?: boolean;
  forceRefresh?: boolean;
}

export function TicketPrinter({
  orderDate,
  orderNumber,
  items,
  total,
  paymentMethod,
  cashierName,
  autoPrint = false,
  hideButton = false,
  forceRefresh = false,
}: TicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const { formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'El Fakir',
    address: 'Calle Principal #123, Ciudad',
    phone: '+34 000 000 000',
  });
  const [dataLoaded, setDataLoaded] = useState(false);
  const hasAutoPrintedRef = useRef<string | null>(null);
  const isPrintingRef = useRef<boolean>(false);

  const isOrderOnly = paymentMethod === 'Pendiente' || paymentMethod === 'En attente';
  const ticketTitle = isOrderOnly
    ? (t('ticket.order_title') || 'COMMANDE / TICKET DE PEDIDO')
    : (t('ticket.title') || 'Ticket de Venta');

  // Cargar información de la empresa
  useEffect(() => {
    setDataLoaded(false);

    const fetchCompanyInfo = async () => {
      try {
        console.log('🔍 TICKET: Fetching company settings...');
        const { data, error } = await supabase
          .from('company_settings')
          .select('company_name, address, phone')
          .single();

        if (error) {
          console.error('❌ TICKET: Error fetching company info:', error);
          return;
        }

        if (data) {
          console.log('✅ TICKET: Company settings loaded successfully:', data);
          setCompanyInfo({
            company_name: data.company_name?.trim() || 'El Fakir',
            address: data.address?.trim() || 'Calle Principal #123, Ciudad',
            phone: data.phone?.trim() || '+34 000 000 000'
          });
        }
      } catch (err) {
        console.error('💥 TICKET: Error loading company info:', err);
      } finally {
        setDataLoaded(true);
      }
    };

    fetchCompanyInfo();

    // Listen for company settings updates
    const handleCompanySettingsUpdate = (event: any) => {
      console.log('🔄 Company settings updated event received');
      if (event.detail) {
        setCompanyInfo({
          company_name: event.detail.company_name?.trim() || 'El Fakir',
          address: event.detail.address?.trim() || 'Calle Principal #123, Ciudad',
          phone: event.detail.phone?.trim() || '+34 000 000 000'
        });
      }
    };

    window.addEventListener('companySettingsUpdated', handleCompanySettingsUpdate);

    return () => {
      window.removeEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
    };
  }, [forceRefresh]);

  const printTicket = async () => {
    if (isMobileDevice()) {
      console.log('📱 Dispositivo móvil: Impresión de ticket en papel delegada al PC de caja.');
      window.dispatchEvent(new CustomEvent('ticketPrinted'));
      return;
    }

    if (isPrintingRef.current) {
      console.warn('⚠️ TICKET: Impresión ya en ejecución, bloqueando duplicado.');
      return;
    }
    isPrintingRef.current = true;

    try {
      if (orderNumber) {
        markOrderPrintedLocally(orderNumber, 'invoice');
      }

      const printContent = ticketRef.current?.innerHTML || '';
      console.log('🖨️ TICKET: printTicket called, content length:', printContent.length);

      if (!printContent || printContent.length < 100) {
        console.error('❌ TICKET: Content too short or empty, skipping print');
        window.dispatchEvent(new CustomEvent('ticketPrinted'));
        return;
      }

      // Build full HTML for the ticket
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${ticketTitle}</title>
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

      // Try silent print via QZ Tray first (no browser dialog)
      try {
        const printed = await qzService.printHTML('', fullHtml, true);
        if (printed) {
          console.log('✅ TICKET: Printed silently via QZ Tray');
          window.dispatchEvent(new CustomEvent('ticketPrinted'));
          return;
        }
      } catch (err) {
        console.warn('⚠️ TICKET: QZ Tray not available, skipping ticket print:', err);
      }

      // QZ Tray not available — skip print silently (no browser dialog)
      console.log('ℹ️ TICKET: QZ Tray unavailable, ticket print skipped');
      window.dispatchEvent(new CustomEvent('ticketPrinted'));
    } finally {
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 1500);
    }
  };

  // Único disparador de autoPrint controlado y protegido contra duplicados
  useEffect(() => {
    if (!autoPrint || !dataLoaded) return;

    const ticketKey = `${orderNumber}_${total}_${paymentMethod}`;
    if (hasAutoPrintedRef.current === ticketKey) {
      console.log('⚠️ TICKET: Omitiendo autoPrint repetido para la misma orden:', ticketKey);
      return;
    }

    console.log('🖨️ TICKET: Ejecutando autoPrint único para:', ticketKey);
    hasAutoPrintedRef.current = ticketKey;

    const timer = setTimeout(() => {
      printTicket();
    }, 120);

    return () => clearTimeout(timer);
  }, [autoPrint, dataLoaded, orderNumber, total, paymentMethod]);

  return (
    <div>
      <div ref={ticketRef} className="hidden">
        <div className="ticket">
          {/* Header */}
          <div className="header">
            <h1>☕ {companyInfo.company_name}</h1>
            {companyInfo.address && <p>{companyInfo.address}</p>}
            {companyInfo.phone && <p>Tel: {companyInfo.phone}</p>}
            <p style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>{ticketTitle}</p>
            <p>═══════</p>
          </div>

          {/* Ticket Info */}
          <div className="ticket-info">
            <div><strong>{t('ticket.number')}</strong> {orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`}</div>
            <div><strong>{t('Fecha')}:</strong> {orderDate.toLocaleDateString('es-ES')}</div>
            <div><strong>{t('ticket.time')}</strong> {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>{t('ticket.cashier')}</strong> {cashierName}</div>
          </div>

          {/* Items */}
          <table className="items-table">
            <thead>
              <tr>
                <th>{t('Cantidad')}</th>
                <th>{t('Producto')}</th>
                <th>{t('ticket.unit_price')}</th>
                <th>{t('Total')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.quantity}</td>
                  <td>
                    <div>{item.name}</div>
                    {item.size && <div style={{ fontSize: '9px', color: '#666' }}>{item.size}</div>}
                  </td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="total-section">
            <div style={{ textAlign: 'right', marginBottom: '3px' }}>
              {t('Total').toUpperCase()}: {formatCurrency(total)}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>
              {t('ticket.payment')} {paymentMethod}
            </div>
          </div>

          {/* Thanks message */}
          <div className="thanks">
            {t('ticket.thanks')}
          </div>

          {/* Footer */}
          <div className="footer">
            <div>{new Date().toLocaleDateString('es-ES')}</div>
            <div>{companyInfo.company_name}</div>
          </div>
        </div>
      </div>

      {!hideButton && (
        <button
          onClick={printTicket}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Printer className="w-4 h-4" />
          {t('ticket.print_button')}
        </button>
      )}
    </div>
  );
}
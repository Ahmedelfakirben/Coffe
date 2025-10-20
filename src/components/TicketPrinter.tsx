import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'El Fakir',
    address: 'Calle Principal #123, Ciudad',
    phone: '+34 000 000 000',
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  // Cargar información de la empresa
  useEffect(() => {
    // Resetear estado cuando cambie el ticket
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
          setDataLoaded(true);

          // Si autoPrint está activo, imprimir con datos por defecto
          if (autoPrint) {
            console.log('🖨️ TICKET: Scheduling auto-print with default data after error');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(() => {
                  console.log('🖨️ TICKET: Executing scheduled auto-print (after fetch error)');
                  printTicket();
                }, 300);
              });
            });
          }
          return;
        }

        if (data) {
          console.log('✅ TICKET: Company settings loaded successfully:', data);
          // Use data from database, fallback to defaults only if empty
          setCompanyInfo({
            company_name: data.company_name?.trim() || 'El Fakir',
            address: data.address?.trim() || 'Calle Principal #123, Ciudad',
            phone: data.phone?.trim() || '+34 000 000 000'
          });
          console.log('📍 TICKET: Setting dataLoaded = true');
          setDataLoaded(true);

          // Si autoPrint está activo, imprimir después de que React actualice el DOM
          if (autoPrint) {
            console.log('🖨️ TICKET: Scheduling auto-print with company data', new Date().toISOString());
            // Usar doble requestAnimationFrame + setTimeout para asegurar que React renderice
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(() => {
                  console.log('🖨️ TICKET: Executing scheduled auto-print', new Date().toISOString());
                  printTicket();
                }, 300);
              });
            });
          }
        } else {
          console.log('⚠️ TICKET: No company data found');
          setDataLoaded(true);

          // Si autoPrint está activo, imprimir con datos por defecto
          if (autoPrint) {
            console.log('🖨️ TICKET: Scheduling auto-print with default data');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(() => {
                  console.log('🖨️ TICKET: Executing scheduled auto-print (default)');
                  printTicket();
                }, 300);
              });
            });
          }
        }
      } catch (err) {
        console.error('💥 TICKET: Error loading company info:', err);
        setDataLoaded(true);

        // Si autoPrint está activo, imprimir incluso si falla
        if (autoPrint) {
          console.log('🖨️ TICKET: Scheduling auto-print despite error');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(() => {
                console.log('🖨️ TICKET: Executing scheduled auto-print (after error)');
                printTicket();
              }, 300);
            });
          });
        }
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
  }, [forceRefresh, autoPrint]);

  const printTicket = () => {
    const printContent = ticketRef.current?.innerHTML || '';
    console.log('🖨️ TICKET: printTicket called, content length:', printContent.length);
    console.log('🖨️ TICKET: Company info at print time:', companyInfo);

    if (!printContent || printContent.length < 100) {
      console.error('❌ TICKET: Content too short or empty, skipping print');
      return;
    }

    const printWindow = window.open('', '', 'height=800,width=400');

    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket de Venta</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                margin: 0;
                padding: 5px;
                background: white;
                font-size: 12px;
                line-height: 1.2;
              }
              .ticket {
                width: 80mm;
                max-width: 300px;
                margin: 0 auto;
                padding: 5px;
                background: white;
              }
              .header {
                text-align: center;
                border-bottom: 1px dashed #000;
                padding-bottom: 5px;
                margin-bottom: 5px;
              }
              .header h1 {
                margin: 0;
                font-size: 16px;
                font-weight: bold;
              }
              .header p {
                margin: 2px 0;
                font-size: 10px;
              }
              .ticket-info {
                margin-bottom: 8px;
                font-size: 11px;
              }
              .ticket-info div {
                margin-bottom: 2px;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
                font-size: 11px;
              }
              .items-table th,
              .items-table td {
                padding: 2px 3px;
                text-align: left;
                border-bottom: 1px dotted #ccc;
              }
              .items-table th {
                font-weight: bold;
                border-bottom: 1px solid #000;
              }
              .total-section {
                border-top: 1px dashed #000;
                padding-top: 5px;
                margin-top: 5px;
                font-weight: bold;
                font-size: 12px;
              }
              .footer {
                text-align: center;
                margin-top: 8px;
                padding-top: 5px;
                border-top: 1px dashed #000;
                font-size: 9px;
                color: #666;
              }
              .thanks {
                margin: 5px 0;
                font-weight: bold;
                font-size: 10px;
              }
              @media print {
                body {
                  background: white !important;
                  margin: 0;
                  padding: 0;
                }
                .ticket {
                  width: 100%;
                  max-width: none;
                  padding: 0;
                }
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();

      // Disparar evento de impresión completada
      console.log('✅ TICKET: Print completed, dispatching event');
      window.dispatchEvent(new CustomEvent('ticketPrinted'));
    } else {
      console.error('❌ TICKET: Failed to open print window');
      // Disparar evento incluso si falla
      window.dispatchEvent(new CustomEvent('ticketPrinted'));
    }
  };

  useEffect(() => {
    console.log('🔍 TICKET: autoPrint useEffect triggered - autoPrint:', autoPrint, 'dataLoaded:', dataLoaded);
    if (autoPrint && dataLoaded) {
      console.log('🖨️ TICKET: Auto-printing with company data:', companyInfo);
      // Small delay to ensure DOM is updated with company info
      setTimeout(() => printTicket(), 100);
    } else {
      console.log('⏳ TICKET: Not printing yet - autoPrint:', autoPrint, 'dataLoaded:', dataLoaded);
    }
  }, [autoPrint, dataLoaded]);

  return (
    <div>
      <div ref={ticketRef} className="hidden">
        <div className="ticket">
          {/* Header */}
          <div className="header">
            <h1>☕ {companyInfo.company_name}</h1>
            {companyInfo.address && <p>{companyInfo.address}</p>}
            {companyInfo.phone && <p>Tel: {companyInfo.phone}</p>}
            <p>Ticket de Venta</p>
            <p>═══════</p>
          </div>

          {/* Ticket Info */}
          <div className="ticket-info">
            <div><strong>Ticket:</strong> #{orderNumber}</div>
            <div><strong>Fecha:</strong> {orderDate.toLocaleDateString('es-ES')}</div>
            <div><strong>Hora:</strong> {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Cajero:</strong> {cashierName}</div>
          </div>

          {/* Items */}
          <table className="items-table">
            <thead>
              <tr>
                <th>Cant</th>
                <th>Producto</th>
                <th>P.U.</th>
                <th>Total</th>
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
                  <td>${item.price.toFixed(2)}</td>
                  <td>${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="total-section">
            <div style={{ textAlign: 'right', marginBottom: '3px' }}>
              TOTAL: ${total.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>
              Pago: {paymentMethod}
            </div>
          </div>

          {/* Thanks message */}
          <div className="thanks">
            ¡Gracias por tu compra!
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
          Imprimir Ticket
        </button>
      )}
    </div>
  );
}
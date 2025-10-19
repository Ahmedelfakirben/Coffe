import { useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';

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
}: TicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  const printTicket = () => {
    const printContent = ticketRef.current?.innerHTML || '';
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
    }
  };

  useEffect(() => {
    if (autoPrint) {
      // Slight delay to ensure content is ready
      setTimeout(() => printTicket(), 50);
    }
  }, [autoPrint]);

  return (
    <div>
      <div ref={ticketRef} className="hidden">
        <div className="ticket">
          {/* Header */}
          <div className="header">
            <h1>☕ Coffee Shop</h1>
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
            <div>www.coffeeshop.com</div>
            <div>Tel: 555-COFFEE</div>
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
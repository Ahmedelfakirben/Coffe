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
    const printWindow = window.open('', '', 'height=600,width=800');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket de Venta</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                margin: 0;
                padding: 20px;
                width: 80mm; /* Ancho estándar para tickets */
              }
              .ticket {
                text-align: center;
                font-size: 12px;
              }
              .header {
                margin-bottom: 10px;
              }
              .divider {
                border-top: 1px dashed #000;
                margin: 10px 0;
              }
              .item {
                text-align: left;
                margin: 5px 0;
              }
              .total {
                font-weight: bold;
                margin-top: 10px;
              }
              .footer {
                margin-top: 20px;
                font-size: 10px;
              }
              @media print {
                body {
                  width: 80mm;
                  margin: 0;
                  padding: 0;
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
          <div className="header">
            <h2>Coffee Shop</h2>
            <p>Sistema de Gestión</p>
            <div className="divider"></div>
            <p>Ticket #: {orderNumber}</p>
            <p>Fecha: {orderDate.toLocaleDateString()}</p>
            <p>Hora: {orderDate.toLocaleTimeString()}</p>
            <p>Cajero: {cashierName}</p>
          </div>

          <div className="divider"></div>

          <div className="items">
            {items.map((item, index) => (
              <div key={index} className="item">
                <p>
                  {item.quantity}x {item.name}
                  {item.size && ` (${item.size})`}
                </p>
                <p>$ {(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="divider"></div>

          <div className="total">
            <p>Total: $ {total.toFixed(2)}</p>
            <p>Método de Pago: {paymentMethod}</p>
          </div>

          <div className="divider"></div>

          <div className="footer">
            <p>¡Gracias por su compra!</p>
            <p>Vuelva pronto</p>
          </div>
        </div>
      </div>

      {!hideButton && (
        <button
          onClick={printTicket}
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
        >
          <Printer className="w-5 h-5" />
          Imprimir Ticket
        </button>
      )}
    </div>
  );
}
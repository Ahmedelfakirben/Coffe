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
    const printWindow = window.open('', '', 'height=800,width=1000');

    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Reporte de Caja</title>
            <style>
              body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                background: white;
              }
              .report {
                max-width: 210mm; /* A4 width */
                margin: 0 auto;
                padding: 20px;
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .header h1 {
                color: #333;
                margin: 0;
                font-size: 28px;
              }
              .header p {
                color: #666;
                margin: 5px 0;
                font-size: 14px;
              }
              .info-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
              }
              .info-item {
                flex: 1;
                text-align: center;
              }
              .info-item strong {
                display: block;
                font-size: 18px;
                color: #333;
                margin-bottom: 5px;
              }
              .info-item span {
                color: #666;
                font-size: 14px;
              }
              .table-container {
                margin: 30px 0;
                border: 1px solid #ddd;
                border-radius: 8px;
                overflow: hidden;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                padding: 12px 15px;
                text-align: left;
                border-bottom: 1px solid #ddd;
              }
              th {
                background: #f8f9fa;
                font-weight: bold;
                color: #333;
              }
              .total-row {
                background: #e9ecef;
                font-weight: bold;
              }
              .total-row td {
                border-top: 2px solid #333;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 12px;
              }
              .signature-section {
                margin-top: 40px;
                display: flex;
                justify-content: space-between;
              }
              .signature-box {
                width: 200px;
                text-align: center;
                border-top: 1px solid #333;
                padding-top: 10px;
              }
              @media print {
                body {
                  background: white !important;
                  -webkit-print-color-adjust: exact;
                }
                .report {
                  box-shadow: none;
                  margin: 0;
                  padding: 15mm;
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
        <div className="report">
          <div className="header">
            <h1>Coffee Shop</h1>
            <p>Sistema de Gestión Integral</p>
            <p>Reporte de Caja</p>
          </div>

          <div className="info-section">
            <div className="info-item">
              <strong>{orderNumber}</strong>
              <span>Número de Reporte</span>
            </div>
            <div className="info-item">
              <strong>{orderDate.toLocaleDateString('es-ES')}</strong>
              <span>Fecha</span>
            </div>
            <div className="info-item">
              <strong>{orderDate.toLocaleTimeString('es-ES')}</strong>
              <span>Hora</span>
            </div>
            <div className="info-item">
              <strong>{cashierName}</strong>
              <span>Cajero</span>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cantidad</th>
                  <th>Producto</th>
                  <th>Tamaño</th>
                  <th>Precio Unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.quantity}</td>
                    <td>{item.name}</td>
                    <td>{item.size || '-'}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
                  <td style={{ fontWeight: 'bold', fontSize: '16px' }}>${total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Método de Pago:</strong> {paymentMethod}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Monto Total:</strong>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                  ${total.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="signature-section">
            <div className="signature-box">
              <p>Firma del Cajero</p>
            </div>
            <div className="signature-box">
              <p>Firma del Supervisor</p>
            </div>
          </div>

          <div className="footer">
            <p>Este documento es oficial y forma parte del registro contable de Coffee Shop</p>
            <p>Generado el {new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      </div>

      {!hideButton && (
        <button
          onClick={printTicket}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          <Printer className="w-5 h-5" />
          Imprimir Reporte
        </button>
      )}
    </div>
  );
}
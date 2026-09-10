import qz from 'qz-tray';
import { toast } from 'react-hot-toast';

export interface PrintData {
  printerName: string;
  data: any[]; // Formato ESC/POS o HTML compatible con QZ
}

class QZTrayService {
  private isConnected = false;
  private connecting = false;

  async connect(customHost?: string): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.connecting) return false;

    this.connecting = true;
    try {
      if (!qz.websocket.isActive()) {
        const host = customHost || localStorage.getItem('qz_server_ip') || undefined;
        const connectOptions: any = { retries: 2, delay: 1 };
        if (host && host.trim() !== '') {
          connectOptions.host = host.trim();
        }
        await qz.websocket.connect(connectOptions);
      }
      this.isConnected = true;
      console.log('✅ QZ Tray conectado exitosamente');
      return true;
    } catch (err) {
      console.error('❌ Error conectando a QZ Tray:', err);
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await qz.websocket.disconnect();
      this.isConnected = false;
    }
  }

  async getPrinters(): Promise<string[]> {
    const connected = await this.connect();
    if (!connected) {
      toast.error('No se pudo conectar con el servicio de impresión local (QZ Tray).');
      return [];
    }

    try {
      const printers = await qz.printers.find();
      return printers;
    } catch (err) {
      console.error('Error buscando impresoras:', err);
      return [];
    }
  }

  async printHTML(printerName: string, htmlContent: string): Promise<boolean> {
    const connected = await this.connect();
    if (!connected) return false;

    try {
      const config = qz.configs.create(printerName, {
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      const data = [{
        type: 'html',
        format: 'plain',
        data: htmlContent
      }];

      await qz.print(config, data);
      return true;
    } catch (err) {
      console.error(`Error imprimiendo en ${printerName}:`, err);
      toast.error(`Error al imprimir en: ${printerName}`);
      return false;
    }
  }

  async printRaw(printerName: string, rawData: any[]): Promise<boolean> {
    const connected = await this.connect();
    if (!connected) return false;

    try {
      const config = qz.configs.create(printerName);
      await qz.print(config, rawData);
      return true;
    } catch (err) {
      console.error(`Error imprimiendo RAW en ${printerName}:`, err);
      toast.error(`Error al imprimir en: ${printerName}`);
      return false;
    }
  }
}

export const qzService = new QZTrayService();

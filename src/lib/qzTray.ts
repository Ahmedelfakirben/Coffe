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
      // Configurar manejadores de seguridad básicos para QZ Tray
      try {
        qz.security.setCertificatePromise((resolve: any) => {
          resolve(); // Conexión anónima / sin certificado comercial
        });
        qz.security.setSignaturePromise(() => (resolve: any) => {
          resolve();
        });
      } catch (secErr) {
        console.warn('Configurando seguridad QZ:', secErr);
      }

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

  async getPrinters(customHost?: string): Promise<string[]> {
    const connected = await this.connect(customHost);
    if (!connected) {
      toast.error('No se pudo conectar con QZ Tray. Asegúrate de que esté abierto en la barra de tareas.');
      return [];
    }

    try {
      console.log('🔍 Solicitando lista de impresoras a QZ Tray...');
      const printers = await qz.printers.find();
      console.log('📋 Impresoras devueltas por QZ Tray:', printers);
      return Array.isArray(printers) ? printers : [];
    } catch (err: any) {
      console.error('Error buscando impresoras en QZ Tray:', err);
      toast.error(`Error buscando impresoras: ${err?.message || err}`);
      return [];
    }
  }

  async resolvePrinter(targetName?: string | null): Promise<string | null> {
    const connected = await this.connect();
    if (!connected) return null;

    try {
      const allPrinters = await qz.printers.find();
      if (!allPrinters || allPrinters.length === 0) {
        console.warn('⚠️ No se encontraron impresoras en el sistema via QZ Tray');
        return null;
      }

      if (targetName && targetName.trim() !== '') {
        const cleanTarget = targetName.trim().toLowerCase();
        
        // 1. Coincidencia exacta
        const exact = allPrinters.find(p => p.toLowerCase() === cleanTarget);
        if (exact) return exact;

        // 2. Coincidencia parcial (por ejemplo si pone "WD8260" y la impresora es "printer WD8260")
        const partial = allPrinters.find(p => p.toLowerCase().includes(cleanTarget) || cleanTarget.includes(p.toLowerCase()));
        if (partial) {
          console.log(`ℹ️ Impresora "${targetName}" resuelta como "${partial}"`);
          return partial;
        }
      }

      // 3. Fallback: impresora predeterminada del sistema
      try {
        const defaultPrinter = await qz.printers.getDefault();
        if (defaultPrinter) {
          console.log(`ℹ️ Usando impresora predeterminada del sistema: "${defaultPrinter}"`);
          return defaultPrinter;
        }
      } catch (defErr) {
        console.warn('No se pudo obtener la impresora predeterminada:', defErr);
      }

      // 4. Si no hay default, tomar la primera impresora que no sea "OneNote" o "PDF" si existe una térmica
      const physicalPrinter = allPrinters.find(p => !p.toLowerCase().includes('pdf') && !p.toLowerCase().includes('onenote') && !p.toLowerCase().includes('xps'));
      return physicalPrinter || allPrinters[0];
    } catch (err) {
      console.error('Error resolviendo impresora:', err);
      return null;
    }
  }

  async printHTML(printerName: string, htmlContent: string): Promise<boolean> {
    const connected = await this.connect();
    if (!connected) {
      toast.error('QZ Tray no está conectado. Abriendo ventana de impresión del navegador...');
      this.fallbackBrowserPrint(htmlContent);
      return false;
    }

    try {
      const resolvedPrinter = await this.resolvePrinter(printerName);
      if (!resolvedPrinter) {
        toast.error(`No se encontró la impresora "${printerName}". Imprimiendo por navegador...`);
        this.fallbackBrowserPrint(htmlContent);
        return false;
      }

      console.log(`🖨️ Imprimiendo ticket en "${resolvedPrinter}" (solicitado: "${printerName}")...`);

      const config = qz.configs.create(resolvedPrinter, {
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        units: 'mm',
        scaleContent: true,
      });

      const data = [{
        type: 'html',
        format: 'plain',
        data: htmlContent
      }];

      await qz.print(config, data);
      toast.success(`Ticket enviado a ${resolvedPrinter}`, { icon: '🖨️' });
      return true;
    } catch (err: any) {
      console.error(`Error imprimiendo en ${printerName}:`, err);
      toast.error(`Error al imprimir en: ${printerName || 'impresora'}. Mostrando ticket en pantalla...`);
      this.fallbackBrowserPrint(htmlContent);
      return false;
    }
  }

  fallbackBrowserPrint(htmlContent: string) {
    try {
      const win = window.open('', '', 'width=450,height=600');
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
        }, 250);
      }
    } catch (e) {
      console.error('Error en fallbackBrowserPrint:', e);
    }
  }

  async printRaw(printerName: string, rawData: any[]): Promise<boolean> {
    const connected = await this.connect();
    if (!connected) return false;

    try {
      const resolvedPrinter = await this.resolvePrinter(printerName);
      if (!resolvedPrinter) return false;

      const config = qz.configs.create(resolvedPrinter);
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

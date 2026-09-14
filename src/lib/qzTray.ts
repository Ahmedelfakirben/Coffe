import qz from 'qz-tray';
import { toast } from 'react-hot-toast';
import forge from 'node-forge';
import { QZ_CERTIFICATE, QZ_PRIVATE_KEY } from './qz_cert';

export interface PrintData {
  printerName: string;
  data: any[]; // Formato ESC/POS o HTML compatible con QZ
}

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

class QZTrayService {
  private isConnected = false;
  private connecting = false;

  async connect(customHost?: string): Promise<boolean> {
    if (isMobileDevice() && !customHost) {
      return false;
    }
    if (this.isConnected && qz.websocket.isActive()) return true;
    if (this.connecting) return false;

    this.connecting = true;
    try {
      // 1. Configurar Certificado Digital (HousePublique)
      qz.security.setCertificatePromise((resolve: any) => {
        resolve(QZ_CERTIFICATE);
      });

      // 2. Configurar Firma Digital con Clave Privada (SHA256withRSA)
      qz.security.setSignatureAlgorithm('SHA256');
      qz.security.setSignaturePromise((toSign: string) => {
        return (resolve: any, reject: any) => {
          try {
            const privateKey = forge.pki.privateKeyFromPem(QZ_PRIVATE_KEY);
            const md = forge.md.sha256.create();
            md.update(toSign, 'utf8');
            const signature = privateKey.sign(md);
            resolve(forge.util.encode64(signature));
          } catch (err) {
            console.error('Error firmando petición QZ:', err);
            reject(err);
          }
        };
      });

      if (!qz.websocket.isActive()) {
        const hostInput = customHost || localStorage.getItem('qz_server_ip') || '';
        const cleanHost = hostInput.trim();

        // En HTTPS (Coolify), QZ Tray requiere WSS seguro en puerto 8181
        // Lista de hosts a probar: si es local, probar 'localhost' y 'localhost.qz.io'
        let hostsToTry: string[] = ['localhost', 'localhost.qz.io'];
        if (cleanHost && cleanHost !== 'localhost') {
          hostsToTry = [cleanHost];
        }

        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

        const connectOptions: any = {
          host: hostsToTry,
          retries: 2,
          delay: 1,
          usingSecure: isHttps // Forzar conexión segura WSS si estamos en HTTPS (Coolify)
        };

        console.log(`🔌 Conectando a QZ Tray (HTTPS=${isHttps}, hosts=${JSON.stringify(hostsToTry)})...`);
        await qz.websocket.connect(connectOptions);
      }
      this.isConnected = true;
      console.log('✅ QZ Tray conectado exitosamente');
      return true;
    } catch (err: any) {
      console.error('❌ Error conectando a QZ Tray:', err);
      this.isConnected = false;
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } catch (e) {
      console.warn('Error desconectando websocket:', e);
    } finally {
      this.isConnected = false;
    }
  }

  async getPrinters(customHost?: string): Promise<string[]> {
    try {
      const connected = await this.connect(customHost);
      if (!connected) return [];
    } catch (connErr: any) {
      console.error('Fallo en connect:', connErr);
      throw connErr;
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
      const allPrinters: string[] = await qz.printers.find();
      if (!allPrinters || allPrinters.length === 0) {
        console.warn('⚠️ No se encontraron impresoras en el sistema via QZ Tray');
        return null;
      }

      if (targetName && targetName.trim() !== '' && targetName.trim().toUpperCase() !== 'DEFAULT') {
        const cleanTarget = targetName.trim().toLowerCase();
        
        // 1. Coincidencia exacta
        const exact = allPrinters.find(p => p.toLowerCase() === cleanTarget);
        if (exact) return exact;

        // 2. Coincidencia parcial
        const partial = allPrinters.find(p => p.toLowerCase().includes(cleanTarget) || cleanTarget.includes(p.toLowerCase()));
        if (partial) {
          console.log(`ℹ️ Impresora "${targetName}" resuelta como "${partial}"`);
          return partial;
        }
        
        // Si pidió una impresora específica y NO existe, fallamos en lugar de usar la default
        // para que no salgan tickets de cocina en la caja.
        console.warn(`⚠️ Impresora específica "${targetName}" no encontrada en el sistema.`);
        return null;
      }

      // 3. Fallback: impresora predeterminada del sistema (solo si no pidió una específica o pidió DEFAULT)
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

  async printHTML(printerName: string, htmlContent: string, allowFallback = false): Promise<boolean> {
    if (isMobileDevice()) {
      console.log('📱 Dispositivo móvil: Impresión local omitida (se procesa en el PC central)');
      return false;
    }

    const connected = await this.connect();
    if (!connected) {
      if (allowFallback) {
        toast.error('QZ Tray no está conectado. Abriendo ventana de impresión del navegador...');
        this.fallbackBrowserPrint(htmlContent);
      } else {
        toast.error('QZ Tray no está conectado. Revisa que el programa esté abierto.');
      }
      return false;
    }

    try {
      const resolvedPrinter = await this.resolvePrinter(printerName);
      if (!resolvedPrinter) {
        if (allowFallback) {
          toast.error(`No se encontró la impresora "${printerName}". Abriendo impresión del navegador...`);
          this.fallbackBrowserPrint(htmlContent);
        } else {
          toast.error(`No se encontró la impresora "${printerName}" en QZ Tray.`);
        }
        return false;
      }

      console.log(`🖨️ Imprimiendo silenciosamente en "${resolvedPrinter}" (solicitado: "${printerName}")...`);

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
      toast.success(`Comanda enviada a ${resolvedPrinter}`, { icon: '🖨️' });
      return true;
    } catch (err: any) {
      console.error(`Error imprimiendo en ${printerName}:`, err);
      if (allowFallback) {
        toast.error(`Error al imprimir en: ${printerName || 'impresora'}. Mostrando ticket en pantalla...`);
        this.fallbackBrowserPrint(htmlContent);
      } else {
        toast.error(`Error de impresión en ${printerName}: ${err?.message || err}`);
      }
      return false;
    }
  }

  fallbackBrowserPrint(htmlContent: string) {
    if (isMobileDevice()) {
      console.log('📱 Dispositivo móvil: Diálogo nativo del sistema bloqueado');
      return;
    }

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

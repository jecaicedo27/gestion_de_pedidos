const axios = require('axios');

class SiigoAutoImportService {
  constructor() {
    this.isRunning = false;
    this.lastCheck = null;
    this.knownInvoices = new Set();
    this.importQueue = [];
    this.maxRetries = 3;
  }

  async startAutoImport() {
    if (this.isRunning) {
      console.log('🔄 Auto-import ya está en ejecución');
      return;
    }

    this.isRunning = true;
    console.log('⏳ Iniciando sistema de importación automática SIIGO (esperando 3 min para estabilidad)...');

    // Delay startup to allow server to stabilize and prioritize manual requests
    setTimeout(async () => {
      console.log('🚀 Ejecutando sistema de importación automática SIIGO ahora...');

      // Cargar facturas existentes para evitar duplicados
      await this.loadExistingInvoices();

      // Iniciar ciclo de monitoreo
      this.startMonitoringCycle();
    }, 180000); // 3 minutes delay
  }

  async loadExistingInvoices() {
    try {
      console.log('📂 Cargando facturas existentes...');
      const response = await axios.get('http://localhost:3001/api/siigo/invoices?page_size=100&enrich=false', {
        timeout: 30000
      });

      if (response.data.success && response.data.data && response.data.data.results) {
        const results = response.data.data.results;
        // Registrar todas como conocidas para evitar duplicados
        results.forEach(inv => this.knownInvoices.add(inv.id));
        // Encolar TODAS las disponibles (no importadas) para importación
        let enqueued = 0;
        for (const invoice of results) {
          const isImported = invoice.is_imported || invoice.import_status === 'imported';
          if (!isImported) {
            this.importQueue.push({ invoice, attempts: 0, timestamp: new Date() });
            enqueued++;
          }
        }
        console.log(`✅ ${this.knownInvoices.size} facturas conocidas | 🧾 Encoladas disponibles: ${enqueued}`);
      }
    } catch (error) {
      console.error('❌ Error cargando facturas existentes:', error.message);
    }
  }

  startMonitoringCycle() {
    // Verificar cada 30 segundos para importación rápida sin saturar SIIGO
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.checkForNewInvoices();
        await this.processImportQueue();
      } catch (error) {
        console.error('❌ Error en ciclo de monitoreo:', error.message);
      }
    }, 30000); // 30 segundos
  }

  async checkForNewInvoices() {
    try {
      console.log('🔍 Verificando nuevas/pending facturas...');
      this.lastCheck = new Date();

      const response = await axios.get('http://localhost:3001/api/siigo/invoices?page_size=100&enrich=false', {
        timeout: 30000
      });

      if (!response.data.success || !response.data.data || !response.data.data.results) {
        return;
      }

      const results = response.data.data.results;
      const isQueued = (id) => this.importQueue.some(item => item.invoice?.id === id);

      let added = 0;
      for (const invoice of results) {
        const imported = invoice.is_imported || invoice.import_status === 'imported';
        if (!imported && !isQueued(invoice.id)) {
          // Asegurar conocido y encolar
          this.knownInvoices.add(invoice.id);
          this.importQueue.push({ invoice, attempts: 0, timestamp: new Date() });
          added++;
        }
      }

      if (added > 0) {
        console.log(`🆕 Encoladas ${added} facturas pendientes para importación`);
        await this.sendNewInvoiceNotification(results.filter(inv => !inv.is_imported));
      }
    } catch (error) {
      console.error('❌ Error verificando nuevas facturas:', error.message);
    }
  }

  async processImportQueue() {
    if (this.importQueue.length === 0) return;

    console.log(`📋 Procesando ${this.importQueue.length} facturas en cola...`);

    // Procesar hasta N facturas a la vez (configurable) para no sobrecargar
    const batchSize = parseInt(process.env.SIIGO_AUTO_IMPORT_BATCH || '1', 10);
    const toProcess = this.importQueue.splice(0, batchSize);

    const results = await Promise.allSettled(
      toProcess.map(async (item) => {
        await this.importInvoiceAutomatically(item);
        return item;
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = toProcess[i];
      if (result.status === 'rejected') {
        console.error(`❌ Error importando factura ${item.invoice.id}:`, result.reason?.message || result.reason);
        if (item.attempts < this.maxRetries) {
          item.attempts++;
          this.importQueue.push(item);
          console.log(`🔄 Reintentando factura ${item.invoice.id} (intento ${item.attempts}/${this.maxRetries})`);
        } else {
          console.log(`❌ Factura ${item.invoice.id} falló después de ${this.maxRetries} intentos`);
          await this.sendImportFailureNotification(item.invoice);
        }
      }
    }
  }

  async importInvoiceAutomatically(item) {
    const { invoice } = item;

    console.log(`📥 Importando automáticamente factura ${invoice.number} (ID: ${invoice.id})`);

    try {
      // Usar el endpoint de importación existente
      const importResponse = await axios.post('http://localhost:3001/api/siigo/import', {
        invoice_ids: [invoice.id],
        autoImport: true
      }, {
        timeout: 60000 // 1 minuto de timeout
      });

      if (importResponse.data.success) {
        console.log(`✅ Factura ${invoice.number} importada exitosamente como pedido #${importResponse.data.orderId}`);

        // Enviar notificación de éxito
        await this.sendImportSuccessNotification(invoice, importResponse.data.orderId);
      } else {
        throw new Error(importResponse.data.message || 'Error en importación');
      }
    } catch (error) {
      throw new Error(`Fallo en importación automática: ${error.message}`);
    }
  }

  async sendNewInvoiceNotification(newInvoices) {
    try {
      console.log(`📢 Notificación: ${newInvoices.length} nuevas facturas detectadas`);
      // Las notificaciones se pueden implementar más adelante
    } catch (error) {
      console.error('❌ Error enviando notificación:', error.message);
    }
  }

  async sendImportSuccessNotification(invoice, orderId) {
    try {
      console.log(`📢 Notificación: Factura ${invoice.number} importada como pedido #${orderId}`);
      // Las notificaciones se pueden implementar más adelante
    } catch (error) {
      console.error('❌ Error enviando notificación de éxito:', error.message);
    }
  }

  async sendImportFailureNotification(invoice) {
    try {
      console.log(`📢 Notificación: Error importando factura ${invoice.number}`);
      // Las notificaciones se pueden implementar más adelante
    } catch (error) {
      console.error('❌ Error enviando notificación de fallo:', error.message);
    }
  }

  stopAutoImport() {
    this.isRunning = false;
    console.log('🛑 Sistema de importación automática detenido');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      knownInvoicesCount: this.knownInvoices.size,
      queueLength: this.importQueue.length,
      lastCheck: this.lastCheck
    };
  }
}

module.exports = new SiigoAutoImportService();

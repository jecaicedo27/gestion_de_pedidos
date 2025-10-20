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
    console.log('🚀 Iniciando sistema de importación automática SIIGO');
    
    // Cargar facturas existentes para evitar duplicados
    await this.loadExistingInvoices();
    
    // Iniciar ciclo de monitoreo
    this.startMonitoringCycle();
  }

  async loadExistingInvoices() {
    try {
      console.log('📂 Cargando facturas existentes...');
      const response = await axios.get('http://localhost:3001/api/siigo/invoices', {
        timeout: 30000
      });
      
      if (response.data.success && response.data.data && response.data.data.results) {
        response.data.data.results.forEach(invoice => {
          this.knownInvoices.add(invoice.id);
        });
        
        console.log(`✅ ${this.knownInvoices.size} facturas existentes cargadas`);
      }
    } catch (error) {
      console.error('❌ Error cargando facturas existentes:', error.message);
    }
  }

  startMonitoringCycle() {
    // Verificar cada 2 minutos (más frecuente que el polling del frontend)
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.checkForNewInvoices();
        await this.processImportQueue();
      } catch (error) {
        console.error('❌ Error en ciclo de monitoreo:', error.message);
      }
    }, 120000); // 2 minutos
  }

  async checkForNewInvoices() {
    try {
      console.log('🔍 Verificando nuevas facturas...');
      this.lastCheck = new Date();
      
      const response = await axios.get('http://localhost:3001/api/siigo/invoices', {
        timeout: 30000
      });
      
      if (!response.data.success || !response.data.data || !response.data.data.results) {
        return;
      }

      const newInvoices = response.data.data.results.filter(invoice => {
        return !this.knownInvoices.has(invoice.id);
      });

      if (newInvoices.length > 0) {
        console.log(`🆕 ${newInvoices.length} nuevas facturas detectadas!`);
        
        // Agregar a la cola de importación
        newInvoices.forEach(invoice => {
          this.knownInvoices.add(invoice.id);
          this.importQueue.push({
            invoice,
            attempts: 0,
            timestamp: new Date()
          });
        });

        // Enviar notificación
        await this.sendNewInvoiceNotification(newInvoices);
      }
    } catch (error) {
      console.error('❌ Error verificando nuevas facturas:', error.message);
    }
  }

  async processImportQueue() {
    if (this.importQueue.length === 0) return;

    console.log(`📋 Procesando ${this.importQueue.length} facturas en cola...`);

    // Procesar hasta 3 facturas a la vez para no sobrecargar
    const toProcess = this.importQueue.splice(0, 3);

    for (const item of toProcess) {
      try {
        await this.importInvoiceAutomatically(item);
      } catch (error) {
        console.error(`❌ Error importando factura ${item.invoice.id}:`, error.message);
        
        // Reintentar si no se han agotado los intentos
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
        invoiceId: invoice.id,
        autoImport: true // Flag para indicar que es importación automática
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

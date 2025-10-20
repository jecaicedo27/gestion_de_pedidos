const axios = require('axios');
const { query } = require('./backend/config/database');

class TestMonitor {
  constructor() {
    this.startTime = new Date();
    this.events = [];
    this.BASE_URL = 'http://localhost:3001';
  }

  log(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const event = {
      timestamp,
      level,
      category,
      message,
      data,
      elapsed: Date.now() - this.startTime.getTime()
    };
    
    this.events.push(event);
    
    const emoji = {
      INFO: '📋',
      SUCCESS: '✅',
      WARNING: '⚠️',
      ERROR: '❌',
      DEBUG: '🔍'
    }[level] || '📝';
    
    console.log(`${emoji} [${timestamp}] [${category}] ${message}`);
    if (data) {
      console.log(`   📊 Data:`, JSON.stringify(data, null, 2));
    }
  }

  async monitorApiCall(method, url, data = null) {
    this.log('INFO', 'API', `${method} ${url}`);
    const startTime = Date.now();
    
    try {
      const response = await axios({
        method,
        url: `${this.BASE_URL}${url}`,
        data,
        headers: data ? { 'Content-Type': 'application/json' } : undefined
      });
      
      const duration = Date.now() - startTime;
      this.log('SUCCESS', 'API', `${method} ${url} - ${response.status} (${duration}ms)`, {
        status: response.status,
        duration,
        dataSize: JSON.stringify(response.data).length
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('ERROR', 'API', `${method} ${url} - Error (${duration}ms)`, {
        status: error.response?.status,
        duration,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  async monitorDatabaseOperation(description, queryFn) {
    this.log('INFO', 'DATABASE', description);
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      this.log('SUCCESS', 'DATABASE', `${description} - Completed (${duration}ms)`, {
        duration,
        resultCount: Array.isArray(result) ? result.length : 1
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('ERROR', 'DATABASE', `${description} - Error (${duration}ms)`, {
        duration,
        error: error.message
      });
      throw error;
    }
  }

  async startMonitoring() {
    console.log('\n🚀 INICIANDO MONITOR DE PRUEBA - SIIGO FIXES VALIDATION');
    console.log('=' .repeat(80));
    console.log(`⏰ Hora de inicio: ${this.startTime.toISOString()}`);
    console.log(`🔧 Fixes aplicados: Document ID (5152), ChatGPT constraints, Config endpoint`);
    console.log('=' .repeat(80));

    // PASO 1: Verificar estado del sistema
    await this.checkSystemHealth();

    // PASO 2: Verificar fixes aplicados
    await this.verifyAppliedFixes();

    // PASO 3: Iniciar monitoreo en tiempo real
    this.startRealTimeMonitoring();

    console.log('\n📊 MONITOR LISTO - Procede con tu prueba');
    console.log('🔍 Monitoreando: API calls, Database ops, SIIGO integration, ChatGPT processing');
    console.log('⚡ El monitor capturará todos los eventos automáticamente\n');
  }

  async checkSystemHealth() {
    this.log('INFO', 'SYSTEM', 'Verificando estado del sistema...');

    // Verificar backend
    try {
      await this.monitorApiCall('GET', '/api/health');
      this.log('SUCCESS', 'SYSTEM', 'Backend respondiendo correctamente');
    } catch (error) {
      this.log('WARNING', 'SYSTEM', 'Backend health check failed');
    }

    // Verificar base de datos
    try {
      await this.monitorDatabaseOperation('Test DB connection', async () => {
        return await query('SELECT 1 as test');
      });
    } catch (error) {
      this.log('ERROR', 'SYSTEM', 'Database connection failed');
    }

    // Verificar tabla ChatGPT
    try {
      await this.monitorDatabaseOperation('Check ChatGPT table', async () => {
        return await query('SELECT COUNT(*) as count FROM chatgpt_processing_log LIMIT 1');
      });
    } catch (error) {
      this.log('WARNING', 'SYSTEM', 'ChatGPT table check failed');
    }
  }

  async verifyAppliedFixes() {
    this.log('INFO', 'FIXES', 'Verificando fixes aplicados...');

    // Verificar SIIGO document ID en código
    const fs = require('fs');
    try {
      const siigoService = fs.readFileSync('backend/services/siigoInvoiceService.js', 'utf8');
      if (siigoService.includes('documentId: 5152')) {
        this.log('SUCCESS', 'FIXES', 'SIIGO Document ID correcto (5152) en siigoInvoiceService.js');
      } else {
        this.log('ERROR', 'FIXES', 'SIIGO Document ID incorrecto en siigoInvoiceService.js');
      }

      const quotationController = fs.readFileSync('backend/controllers/quotationController.js', 'utf8');
      if (quotationController.includes("'FV-1': 5152")) {
        this.log('SUCCESS', 'FIXES', 'SIIGO Document ID correcto (5152) en quotationController.js');
      } else {
        this.log('ERROR', 'FIXES', 'SIIGO Document ID incorrecto en quotationController.js');
      }
    } catch (error) {
      this.log('ERROR', 'FIXES', 'No se pudieron verificar los archivos de código');
    }

    // Verificar constraint ChatGPT
    try {
      const constraints = await query(`
        SELECT CONSTRAINT_NAME, DELETE_RULE 
        FROM information_schema.REFERENTIAL_CONSTRAINTS 
        WHERE TABLE_NAME = 'chatgpt_processing_log'
        AND CONSTRAINT_SCHEMA = 'gestion_pedidos_dev'
      `);
      
      if (constraints.length > 0) {
        this.log('SUCCESS', 'FIXES', 'ChatGPT foreign key constraint configurado', constraints);
      } else {
        this.log('WARNING', 'FIXES', 'No se encontraron constraints para ChatGPT table');
      }
    } catch (error) {
      this.log('WARNING', 'FIXES', 'No se pudo verificar ChatGPT constraint');
    }
  }

  startRealTimeMonitoring() {
    // Monitor de logs del terminal en tiempo real
    this.log('INFO', 'MONITOR', 'Iniciando monitoreo en tiempo real...');
    
    // Interceptar errores específicos
    process.on('unhandledRejection', (reason, promise) => {
      this.log('ERROR', 'SYSTEM', 'Unhandled Promise Rejection', {
        reason: reason.toString(),
        stack: reason.stack
      });
    });

    // Establecer intervalos de monitoreo
    setInterval(() => this.periodicHealthCheck(), 30000); // Cada 30 segundos
  }

  async periodicHealthCheck() {
    try {
      // Verificar facturas recientes
      const recentInvoices = await query(`
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `);
      
      if (recentInvoices[0].count > 0) {
        this.log('INFO', 'PERIODIC', `${recentInvoices[0].count} nuevas órdenes en últimos 5 minutos`);
      }

      // Verificar errores recientes en logs ChatGPT
      const recentChatGPTLogs = await query(`
        SELECT COUNT(*) as count 
        FROM chatgpt_processing_log 
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `);
      
      if (recentChatGPTLogs[0].count > 0) {
        this.log('INFO', 'PERIODIC', `${recentChatGPTLogs[0].count} procesos ChatGPT en últimos 5 minutos`);
      }
    } catch (error) {
      // Ignorar errores del health check periódico
    }
  }

  async monitorQuotationTest(customerId, items, notes) {
    this.log('INFO', 'TEST', 'INICIANDO PRUEBA DE COTIZACIÓN → FACTURA');
    this.log('INFO', 'TEST', 'Datos de prueba', { customerId, itemCount: items.length, notes });

    try {
      // Step 1: Crear factura desde cotización
      this.log('INFO', 'TEST', 'Paso 1: Creando factura desde cotización...');
      
      const invoiceData = {
        customerId,
        items,
        notes,
        documentType: 'FV-1'
      };

      const response = await this.monitorApiCall('POST', '/api/quotations/create-invoice', invoiceData);
      
      if (response.data.success) {
        this.log('SUCCESS', 'TEST', 'FACTURA CREADA EXITOSAMENTE!', {
          invoiceId: response.data.data.siigo_invoice_id,
          invoiceNumber: response.data.data.siigo_invoice_number,
          documentId: response.data.data.siigo_request_data?.document?.id
        });
        
        return { success: true, data: response.data };
      } else {
        this.log('ERROR', 'TEST', 'Error creando factura', response.data);
        return { success: false, error: response.data };
      }
    } catch (error) {
      this.log('ERROR', 'TEST', 'Error en prueba de cotización', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async monitorChatGPTTest(customerId, naturalLanguageOrder) {
    this.log('INFO', 'TEST', 'INICIANDO PRUEBA CHATGPT → FACTURA');
    this.log('INFO', 'TEST', 'Pedido en lenguaje natural', { customerId, order: naturalLanguageOrder });

    try {
      const chatGPTData = {
        customer_id: customerId,
        natural_language_order: naturalLanguageOrder,
        notes: 'Prueba de ChatGPT después de fixes'
      };

      const response = await this.monitorApiCall('POST', '/api/quotations/create-siigo-invoice-with-chatgpt', chatGPTData);
      
      if (response.data.success) {
        this.log('SUCCESS', 'TEST', 'FACTURA CHATGPT CREADA EXITOSAMENTE!', {
          invoiceId: response.data.data.siigo_invoice_id,
          itemsDetected: response.data.data.chatgpt_stats?.items_detected,
          confidence: response.data.data.chatgpt_stats?.confidence_average
        });
        
        return { success: true, data: response.data };
      } else {
        this.log('ERROR', 'TEST', 'Error creando factura ChatGPT', response.data);
        return { success: false, error: response.data };
      }
    } catch (error) {
      this.log('ERROR', 'TEST', 'Error en prueba ChatGPT', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return { success: false, error: error.response?.data || error.message };
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 REPORTE FINAL DEL MONITOR');
    console.log('='.repeat(80));
    
    const totalTime = Date.now() - this.startTime.getTime();
    console.log(`⏱️ Tiempo total de monitoreo: ${Math.round(totalTime / 1000)}s`);
    console.log(`📝 Total de eventos capturados: ${this.events.length}`);

    // Contar eventos por categoría
    const categories = {};
    const levels = { INFO: 0, SUCCESS: 0, WARNING: 0, ERROR: 0, DEBUG: 0 };

    this.events.forEach(event => {
      categories[event.category] = (categories[event.category] || 0) + 1;
      levels[event.level] = (levels[event.level] || 0) + 1;
    });

    console.log('\n📈 Resumen por categoría:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} eventos`);
    });

    console.log('\n🚦 Resumen por nivel:');
    Object.entries(levels).forEach(([level, count]) => {
      if (count > 0) {
        const emoji = { INFO: '📋', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌', DEBUG: '🔍' }[level];
        console.log(`   ${emoji} ${level}: ${count}`);
      }
    });

    // Mostrar errores si los hay
    const errors = this.events.filter(e => e.level === 'ERROR');
    if (errors.length > 0) {
      console.log('\n❌ ERRORES DETECTADOS:');
      errors.forEach(error => {
        console.log(`   • [${error.category}] ${error.message}`);
      });
    } else {
      console.log('\n✅ NO SE DETECTARON ERRORES CRÍTICOS');
    }

    console.log('='.repeat(80));
  }
}

// Función principal de monitoreo
async function main() {
  const monitor = new TestMonitor();
  
  try {
    await monitor.startMonitoring();
    
    // Mantener el monitor activo
    process.on('SIGINT', () => {
      console.log('\n🛑 Monitor detenido por el usuario');
      monitor.generateReport();
      process.exit(0);
    });

    // El monitor se queda corriendo indefinidamente
    await new Promise(resolve => {
      // Se queda escuchando hasta que se termine manualmente
    });
    
  } catch (error) {
    console.error('❌ Error en el monitor:', error);
    process.exit(1);
  }
}

// Exportar para uso en otros scripts
module.exports = { TestMonitor };

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

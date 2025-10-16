const { initialize, signIn, CustomerApi, InvoiceApi, AccountsPayableApi } = require('siigo_api');
const { query } = require('../config/database');

class SiigoSdkService {
  constructor() {
    this.baseURL = process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com';
    this.urlSignIn = `${this.baseURL}/auth`;
    this.username = process.env.SIIGO_API_USERNAME;
    this.accessKey = process.env.SIIGO_API_ACCESS_KEY;
    this.enabled = process.env.SIIGO_ENABLED === 'true';
    
    // Inicializar SDK oficial de SIIGO
    try {
      initialize({
        basePath: this.baseURL,
        urlSignIn: this.urlSignIn,
        userName: this.username,
        accessKey: this.accessKey
      });
      
      // Inicializar APIs del SDK
      this.customerApi = new CustomerApi();
      this.invoiceApi = new InvoiceApi();
      this.accountsPayableApi = new AccountsPayableApi();
      
      console.log('🔧 SIIGO SDK inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando SDK SIIGO:', error.message);
    }
  }

  /**
   * Obtener cuentas por cobrar usando SDK oficial
   */
  async getCustomerAccountsReceivable(customerIdentification) {
    try {
      console.log(`💰 [SDK] Obteniendo cuentas por cobrar para cliente: ${customerIdentification}`);
      
      if (!this.enabled) {
        console.log('⚠️  SIIGO está deshabilitado');
        return {
          total_balance: 0,
          pending_invoices: [],
          total_invoices: 0,
          source: 'disabled'
        };
      }

      // Primero buscar el cliente por NIT
      const customer = await this.findCustomerByNit(customerIdentification);
      
      if (!customer) {
        console.log(`❌ Cliente no encontrado con NIT: ${customerIdentification}`);
        return {
          total_balance: 0,
          pending_invoices: [],
          total_invoices: 0,
          source: 'customer_not_found'
        };
      }

      console.log(`✅ Cliente encontrado: ${customer.name} (ID: ${customer.id})`);

      // Usar SDK para obtener cuentas por cobrar
      let accountsReceivableData;
      
      try {
        // Intentar obtener facturas del cliente usando SDK
        accountsReceivableData = await this.invoiceApi.invoiceGet({
          customer: customer.id,
          page_size: 100
        });
        
        return this.calculateBalanceFromInvoices(accountsReceivableData, customerIdentification);
      } catch (sdkError) {
        console.log('⚠️  Error con SDK, usando fallback a servicio original...');
        return this.fallbackToOriginalService(customerIdentification);
      }

      // Procesar respuesta del SDK
      return this.processAccountsReceivableResponse(accountsReceivableData, customerIdentification);

    } catch (error) {
      console.error(`❌ Error con SDK SIIGO para ${customerIdentification}:`, error.message);
      
      // Fallback al servicio original si el SDK falla
      console.log('🔄 Intentando con servicio original como fallback...');
      return this.fallbackToOriginalService(customerIdentification);
    }
  }

  /**
   * Buscar cliente por NIT usando SDK
   */
  async findCustomerByNit(nit) {
    try {
      console.log(`🔍 [SDK] Buscando cliente por NIT: ${nit}`);
      
      // Usar método del SDK para buscar cliente
      const customersResponse = await this.customerApi.customerGet({
        identification: nit,
        page_size: 10
      });

      if (customersResponse && customersResponse.results && customersResponse.results.length > 0) {
        const customer = customersResponse.results[0];
        console.log(`✅ Cliente encontrado con SDK: ${customer.name || customer.id}`);
        return customer;
      }

      console.log(`❌ Cliente no encontrado con NIT: ${nit}`);
      return null;
    } catch (error) {
      console.error(`❌ Error buscando cliente por NIT ${nit} con SDK:`, error.message);
      return null;
    }
  }

  /**
   * Procesar respuesta de cuentas por cobrar del SDK
   */
  processAccountsReceivableResponse(data, customerIdentification) {
    try {
      console.log('📊 Procesando respuesta de cuentas por cobrar del SDK...');
      
      let totalBalance = 0;
      const pendingInvoices = [];

      if (data && data.results) {
        for (const item of data.results) {
          const balance = parseFloat(item.balance || item.amount_due || 0);
          
          if (balance > 0) {
            totalBalance += balance;
            pendingInvoices.push({
              invoice_id: item.invoice_id || item.id,
              invoice_number: item.invoice_number || item.number || item.name,
              total: parseFloat(item.total || item.amount || 0),
              paid: parseFloat(item.paid || 0),
              balance: balance,
              created_date: item.created_date || item.date,
              due_date: item.due_date
            });

            console.log(`💳 Factura ${item.invoice_number || item.id}: Saldo $${balance.toLocaleString()}`);
          }
        }
      } else if (data && typeof data.total_balance !== 'undefined') {
        // Respuesta directa con saldo total
        totalBalance = parseFloat(data.total_balance || 0);
        console.log(`💰 Saldo total directo del SDK: $${totalBalance.toLocaleString()}`);
      }

      console.log(`💰 [SDK] Saldo total calculado: $${totalBalance.toLocaleString()}`);

      return {
        total_balance: totalBalance,
        pending_invoices: pendingInvoices,
        total_invoices: pendingInvoices.length,
        source: 'siigo_sdk'
      };
    } catch (error) {
      console.error('❌ Error procesando respuesta del SDK:', error.message);
      return {
        total_balance: 0,
        pending_invoices: [],
        total_invoices: 0,
        source: 'sdk_processing_error'
      };
    }
  }

  /**
   * Calcular saldo desde facturas cuando no hay método directo
   */
  async calculateBalanceFromInvoices(invoicesData, customerIdentification) {
    try {
      console.log('🧮 Calculando saldos desde facturas...');
      
      let totalBalance = 0;
      const pendingInvoices = [];

      if (invoicesData && invoicesData.results) {
        for (const invoice of invoicesData.results) {
          const total = parseFloat(invoice.total || 0);
          const payments = invoice.payments || [];
          
          // Calcular total pagado
          const totalPaid = payments.reduce((sum, payment) => {
            return sum + parseFloat(payment.value || payment.amount || 0);
          }, 0);
          
          // Calcular saldo pendiente
          const balance = total - totalPaid;
          
          if (balance > 0) {
            totalBalance += balance;
            pendingInvoices.push({
              invoice_id: invoice.id,
              invoice_number: invoice.name || invoice.number,
              total: total,
              paid: totalPaid,
              balance: balance,
              created_date: invoice.created || invoice.date,
              due_date: invoice.due_date
            });
            
            console.log(`💳 Factura ${invoice.name}: Total $${total.toLocaleString()} - Pagado $${totalPaid.toLocaleString()} - Saldo $${balance.toLocaleString()}`);
          }
        }
      }

      console.log(`💰 [Calculado] Saldo total: $${totalBalance.toLocaleString()}`);

      return {
        total_balance: totalBalance,
        pending_invoices: pendingInvoices,
        total_invoices: pendingInvoices.length,
        source: 'calculated_from_invoices'
      };
    } catch (error) {
      console.error('❌ Error calculando saldos:', error.message);
      return {
        total_balance: 0,
        pending_invoices: [],
        total_invoices: 0,
        source: 'calculation_error'
      };
    }
  }

  /**
   * Fallback al servicio original si el SDK falla
   */
  async fallbackToOriginalService(customerIdentification) {
    try {
      console.log('🔄 Usando servicio original como fallback...');
      
      // Importar y usar el servicio original
      const originalSiigoService = require('./siigoService');
      
      // Buscar cliente por NIT primero
      const customer = await originalSiigoService.findCustomerByNit(customerIdentification);
      
      if (!customer) {
        return {
          total_balance: 0,
          pending_invoices: [],
          total_invoices: 0,
          source: 'fallback_customer_not_found'
        };
      }

      // Usar método original de cuentas por cobrar
      const result = await originalSiigoService.getCustomerAccountsReceivable(customer.id);
      
      return {
        ...result,
        source: 'fallback_original_service'
      };
    } catch (error) {
      console.error('❌ Error en fallback:', error.message);
      return {
        total_balance: 0,
        pending_invoices: [],
        total_invoices: 0,
        source: 'fallback_error'
      };
    }
  }

  /**
   * Obtener facturas usando SDK
   */
  async getInvoices(filters = {}) {
    try {
      console.log('📋 [SDK] Obteniendo lista de facturas...');
      
      const params = {
        page: filters.page || 1,
        page_size: filters.page_size || 50
      };

      if (filters.customer) params.customer = filters.customer;
      if (filters.created_start) params.created_start = filters.created_start;
      if (filters.created_end) params.created_end = filters.created_end;

      const response = await this.invoiceApi.invoiceGet(params);
      
      console.log(`✅ ${response.results?.length || 0} facturas obtenidas con SDK`);
      return response;
    } catch (error) {
      console.error('❌ Error obteniendo facturas con SDK:', error.message);
      throw error;
    }
  }

  /**
   * Obtener factura por ID usando SDK
   */
  async getInvoice(invoiceId) {
    try {
      console.log(`📄 [SDK] Obteniendo factura: ${invoiceId}`);
      
      const response = await this.invoiceApi.invoiceGetById(invoiceId);
      
      console.log('✅ Factura obtenida con SDK');
      return response;
    } catch (error) {
      console.error(`❌ Error obteniendo factura ${invoiceId} con SDK:`, error.message);
      throw error;
    }
  }

  /**
   * Verificar estado de conexión del SDK
   */
  async checkConnection() {
    try {
      console.log('🔍 Verificando conexión del SDK...');
      
      // Hacer una llamada simple para verificar conectividad
      await signIn({
        userName: this.username,
        accessKey: this.accessKey
      });
      
      return {
        connected: true,
        sdk_version: '3.1.0',
        message: 'Conexión exitosa con SIIGO SDK'
      };
    } catch (error) {
      console.error('❌ Error de conexión del SDK:', error.message);
      return {
        connected: false,
        sdk_version: '3.1.0',
        error: error.message
      };
    }
  }

  /**
   * Guardar configuración en base de datos
   */
  async saveConfig(key, value) {
    try {
      await query(
        `INSERT INTO siigo_configurations (config_key, config_value, created_at) 
         VALUES (?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()`,
        [key, value]
      );
    } catch (error) {
      console.error('❌ Error guardando configuración SIIGO:', error.message);
    }
  }

  /**
   * Obtener configuración de base de datos
   */
  async getConfig(key) {
    try {
      const result = await query(
        'SELECT config_value FROM siigo_configurations WHERE config_key = ? AND is_active = TRUE',
        [key]
      );
      
      return result.length > 0 ? result[0].config_value : null;
    } catch (error) {
      console.error('❌ Error obteniendo configuración SIIGO:', error.message);
      return null;
    }
  }
}

// Instancia singleton
const siigoSdkService = new SiigoSdkService();

module.exports = siigoSdkService;

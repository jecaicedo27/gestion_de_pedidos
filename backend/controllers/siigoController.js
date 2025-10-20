
const siigoService = require('../services/siigoService');
const { pool } = require('../config/database');

async function isSiigoEnabled() {
  try {
    const [rows] = await pool.execute(
      'SELECT is_enabled FROM siigo_credentials WHERE company_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [1]
    );
    return rows.length > 0 && !!rows[0].is_enabled;
  } catch (e) {
    console.warn('⚠️ No se pudo leer is_enabled desde BD, asumiendo deshabilitado:', e.message);
    return false;
  }
}

const siigoController = {
  async getInvoices(req, res) {
    try {
      console.log('📋 Solicitud de facturas SIIGO recibida');
      
      const { page = 1, page_size = 100, start_date } = req.query;
      
      // Si SIIGO no está habilitado en BD, devolver respuesta vacía y evitar 500
      if (!(await isSiigoEnabled())) {
        return res.json({
          success: true,
          message: 'SIIGO deshabilitado en esta instancia',
          data: {
            results: [],
            pagination: {
              page: parseInt(page),
              page_size: parseInt(page_size),
              total: 0,
              pages: 0
            }
          }
        });
      }
      
      // Obtener fecha de inicio del sistema
      let systemStartDate = start_date;
      
      if (!systemStartDate) {
        try {
          console.log('📅 Obteniendo fecha de inicio del sistema...');
          const [startDateConfig] = await pool.execute(`
            SELECT config_value, data_type 
            FROM system_config 
            WHERE config_key = 'siigo_start_date' 
              AND (SELECT config_value FROM system_config WHERE config_key = 'siigo_start_date_enabled') = 'true'
          `);
          
          if (startDateConfig.length > 0) {
            systemStartDate = startDateConfig[0].config_value;
            console.log(`✅ Usando fecha de inicio del sistema: ${systemStartDate}`);
          } else {
            console.log('⚠️ Fecha de inicio del sistema no configurada, usando fecha por defecto');
            systemStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          }
        } catch (error) {
          console.warn('⚠️ Error obteniendo fecha de inicio del sistema, usando fecha por defecto:', error.message);
          systemStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
      }
      
      // Obtener facturas desde SIIGO con rate limiting
      const siigoData = await siigoService.getInvoices({
        page: parseInt(page),
        page_size: parseInt(page_size),
        start_date: systemStartDate
      });
      
      if (!siigoData.results) {
        return res.json({
          success: true,
          data: {
            results: [],
            pagination: {
              page: parseInt(page),
              page_size: parseInt(page_size),
              total: 0,
              pages: 0
            }
          }
        });
      }
      
      console.log(`✅ ${siigoData.results.length} facturas obtenidas (desde ${start_date || 'ayer'})`);
      
      // Filtrar facturas ya importadas
      console.log('🔍 Filtrando facturas ya importadas...');
      const [existingInvoices] = await pool.execute(
        'SELECT siigo_invoice_id FROM orders WHERE siigo_invoice_id IS NOT NULL'
      );
      
      const existingIds = new Set(existingInvoices.map(inv => inv.siigo_invoice_id));
      const filteredInvoices = siigoData.results.filter(inv => !existingIds.has(inv.id));
      
      console.log(`📊 Facturas obtenidas de SIIGO: ${siigoData.results.length}`);
      console.log(`📊 Facturas ya importadas en BD: ${existingIds.size}`);
      console.log(`📊 Facturas disponibles para importar: ${filteredInvoices.length}`);
      
      // MOSTRAR TODAS LAS FACTURAS - Marcar las ya importadas pero no ocultarlas
      console.log('📊 Facturas obtenidas de SIIGO:', siigoData.results.length);
      console.log('📊 Facturas ya importadas en BD:', existingIds.size);
      console.log('📊 Facturas disponibles para importar:', filteredInvoices.length);
      
      // USAR TODAS LAS FACTURAS EN LUGAR DE SOLO LAS FILTRADAS
      const allInvoicesWithStatus = siigoData.results.map(invoice => ({
        ...invoice,
        // Marcar si ya está importada
        is_imported: existingIds.has(invoice.id),
        import_status: existingIds.has(invoice.id) ? 'imported' : 'available'
      }));
      
      console.log('✅ Mostrando todas las facturas:', allInvoicesWithStatus.length);
      
      // Enriquecer con información completa de clientes usando la misma lógica que funciona en importación
      console.log('🔍 Enriqueciendo facturas con información completa de clientes...');
      const uniqueCustomerIds = [...new Set(filteredInvoices
        .filter(inv => inv.customer?.id)
        .map(inv => inv.customer.id))];
      
      console.log(`📋 Clientes únicos a consultar: ${uniqueCustomerIds.length}`);
      
      // Función para extraer nombre del cliente con múltiples fallbacks (igual que en siigoService)
      const extractCustomerName = (customer, customerInfo) => {
        // Prioridad 1: Nombre comercial del customerInfo detallado (IGNORAR "No aplica")
        if (customerInfo.commercial_name && customerInfo.commercial_name !== 'No aplica') {
          return customerInfo.commercial_name;
        }
        
        // Prioridad 2: Persona física - construir nombre completo
        if (customerInfo.name && Array.isArray(customerInfo.name) && customerInfo.name.length >= 2) {
          return customerInfo.name.join(' ').trim();
        }
        
        // Prioridad 3: first_name + last_name si existe person
        if (customerInfo.person?.first_name) {
          return `${customerInfo.person.first_name} ${customerInfo.person.last_name || ''}`.trim();
        }
        
        // Prioridad 4: Empresa - company name
        if (customerInfo.company?.name) return customerInfo.company.name;
        
        // Prioridad 5: Nombre del customer básico (IGNORAR "No aplica")
        if (customer?.commercial_name && customer.commercial_name !== 'No aplica') {
          return customer.commercial_name;
        }
        if (customer?.name) return customer.name;
        
        // Prioridad 6: Identification name
        if (customerInfo.identification?.name) return customerInfo.identification.name;
        if (customer?.identification?.name) return customer.identification.name;
        
        // Fallback final
        return 'Cliente SIIGO';
      };
      
      const enrichedInvoices = await Promise.all(
        allInvoicesWithStatus.map(async (invoice) => {
          try {
            if (invoice.customer?.id) {
              const customerInfo = await siigoService.getCustomer(invoice.customer.id);
              
              // Usar la misma lógica de extracción que funciona en la importación
              const customerName = extractCustomerName(invoice.customer, customerInfo);
              
              return {
                ...invoice,
                customer: {
                  ...invoice.customer,
                  // Sobrescribir con información enriquecida
                  commercial_name: customerName,
                  name: customerName,
                  // Mantener información adicional
                  identification: customerInfo.identification,
                  person: customerInfo.person,
                  company: customerInfo.company,
                  contacts: customerInfo.contacts,
                  address: customerInfo.address,
                  phones: customerInfo.phones,
                  email: customerInfo.contacts?.[0]?.email || customerInfo.email,
                  mail: customerInfo.contacts?.[0]?.email || customerInfo.email
                },
                customer_info: {
                  commercial_name: customerName,
                  phone: customerInfo.phones?.[0]?.number || 'Sin teléfono',
                  address: customerInfo.address?.address || 'Sin dirección',
                  email: customerInfo.contacts?.[0]?.email || customerInfo.email || 'Sin email'
                }
              };
            }
            return invoice;
          } catch (error) {
            console.warn(`⚠️ Error obteniendo cliente para factura ${invoice.name}:`, error.message);
            return invoice;
          }
        })
      );
      
      console.log(`✅ Enriquecimiento completado usando caché de ${uniqueCustomerIds.length} clientes`);
      
      res.json({
        success: true,
        data: {
          results: enrichedInvoices,
          pagination: {
            page: parseInt(page),
            page_size: parseInt(page_size),
            total: siigoData.pagination?.total_results || enrichedInvoices.length,
            pages: Math.ceil((siigoData.pagination?.total_results || enrichedInvoices.length) / parseInt(page_size)),
            showing_all: true,
            imported_count: existingIds.size
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo facturas SIIGO:', error.message);
      // Manejo específico: credenciales faltantes o autenticación fallida
      if (
        error.message?.includes('No se pudo autenticar con SIIGO API') ||
        error.message?.includes('Credenciales SIIGO no configuradas') ||
        error.response?.status === 401
      ) {
        return res.status(503).json({
          success: false,
          message: 'Servicio SIIGO no disponible o no configurado',
          error: 'SIIGO_AUTH_ERROR'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error obteniendo facturas de SIIGO',
        error: error.message
      });
    }
  },

  async importInvoices(req, res) {
    try {
      console.log('📥 Solicitud de importación recibida');
      console.log('Body:', req.body);
      
      const { invoice_ids, payment_method = 'transferencia', delivery_method = 'domicilio' } = req.body;
      
      if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs de facturas requeridos'
        });
      }
      
      console.log(`📋 Importando ${invoice_ids.length} facturas con rate limiting...`);
      
      const result = await siigoService.importInvoices(invoice_ids, payment_method, delivery_method);
      
      res.json({
        success: true,
        message: `Importación completada: ${result.summary.successful}/${result.summary.total} exitosas`,
        results: result.results,
        summary: result.summary
      });
      
    } catch (error) {
      console.error('❌ Error en importación:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error importando facturas',
        error: error.message
      });
    }
  },

  async getInvoiceDetails(req, res) {
    try {
      const { id } = req.params;
      console.log(`📋 Obteniendo detalles de factura SIIGO: ${id}`);
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de factura requerido'
        });
      }
      
      // Obtener detalles completos de la factura desde SIIGO
      const invoiceDetails = await siigoService.getInvoiceDetails(id);
      
      if (!invoiceDetails) {
        return res.status(404).json({
          success: false,
          message: 'Factura no encontrada'
        });
      }
      
      console.log(`✅ Detalles de factura ${id} obtenidos exitosamente`);
      
      // Enriquecer con información del cliente si existe
      try {
        if (invoiceDetails.customer?.id) {
          console.log(`🔍 Obteniendo información del cliente: ${invoiceDetails.customer.id}`);
          const customerInfo = await siigoService.getCustomer(invoiceDetails.customer.id);
          
          // Combinar información del cliente
          invoiceDetails.customer = {
            ...invoiceDetails.customer,
            ...customerInfo,
            // Preservar estructura original pero añadir detalles
            full_details: customerInfo
          };
          
          console.log(`✅ Información del cliente añadida exitosamente`);
        }
      } catch (error) {
        console.warn(`⚠️ Error obteniendo cliente para factura ${id}:`, error.message);
        // Continuar sin información del cliente en lugar de fallar
      }
      
      res.json({
        success: true,
        data: invoiceDetails
      });
      
    } catch (error) {
      console.error(`❌ Error obteniendo detalles de factura ${req.params.id}:`, error.message);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo detalles de la factura',
        error: error.message
      });
    }
  },

  async getConnectionStatus(req, res) {
    try {
      const token = await siigoService.authenticate();
      
      res.json({
        success: true,
        connected: !!token,
        message: token ? 'Conectado a SIIGO API' : 'No conectado',
        requestCount: siigoService.requestCount
      });
      
    } catch (error) {
      console.error('❌ Error verificando conexión SIIGO:', error.message);
      res.status(500).json({
        success: false,
        connected: false,
        message: 'Error de conexión',
        error: error.message
      });
    }
  },

  async getAutomationStatus(req, res) {
    try {
      const siigoUpdateService = require('../services/siigoUpdateService');
      
      res.json({
        success: true,
        data: {
          isRunning: siigoUpdateService.isRunning,
          interval: siigoUpdateService.updateInterval,
          intervalMinutes: Math.round(siigoUpdateService.updateInterval / (1000 * 60)),
          message: siigoUpdateService.isRunning 
            ? `Servicio automático ejecutándose cada ${Math.round(siigoUpdateService.updateInterval / (1000 * 60))} minutos`
            : 'Servicio automático detenido'
        }
      });
      
    } catch (error) {
      console.error('❌ Error verificando estado del servicio automático:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error verificando estado del servicio',
        error: error.message
      });
    }
  }
};

module.exports = siigoController;

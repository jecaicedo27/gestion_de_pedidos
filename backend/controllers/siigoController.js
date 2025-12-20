const siigoService = require('../services/siigoService');
const { pool } = require('../config/database');
const customerService = require('../services/customerService');

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
  async getImportSummary(req, res) {
    try {
      // Determinar fecha de inicio (habilitada)
      let systemStartDate = null;
      try {
        const [startDateConfig] = await pool.execute(`
          SELECT config_value
          FROM system_config 
          WHERE config_key = 'siigo_start_date' 
            AND (SELECT config_value FROM system_config WHERE config_key = 'siigo_start_date_enabled') = 'true'
        `);
        systemStartDate = startDateConfig?.[0]?.config_value || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } catch {
        systemStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      // Obtener TODAS las facturas desde SIIGO (paginando) para no perder registros (p.ej. 104 > 100)
      const pageSize = 100;
      const firstPage = await siigoService.getInvoices({ page: 1, page_size: pageSize, created_start: systemStartDate });
      const totalFromSiigo = parseInt(firstPage?.pagination?.total_results || 0, 10);
      let totalPages = parseInt(firstPage?.pagination?.total_pages || 0, 10);
      if (!totalPages || Number.isNaN(totalPages) || totalPages < 1) {
        totalPages = Math.max(1, Math.ceil(totalFromSiigo / pageSize));
      }
      let results = Array.isArray(firstPage?.results) ? [...firstPage.results] : [];
      for (let p = 2; p <= totalPages; p++) {
        try {
          const pageData = await siigoService.getInvoices({ page: p, page_size: pageSize, created_start: systemStartDate });
          if (Array.isArray(pageData?.results) && pageData.results.length > 0) {
            results.push(...pageData.results);
          } else {
            break;
          }
        } catch (e) {
          console.warn(`⚠️ Error obteniendo página ${p} de SIIGO:`, e.message);
          break;
        }
      }

      // Nota: NO filtramos por inv.date; usamos created_start como criterio oficial

      // Identificar cuáles ya están importadas en BD
      const [existingInvoices] = await pool.execute('SELECT siigo_invoice_id FROM orders WHERE siigo_invoice_id IS NOT NULL');
      const existingIds = new Set(existingInvoices.map(r => r.siigo_invoice_id));
      const importedInResults = results.filter(r => existingIds.has(r.id)).length;
      const pending = Math.max(results.length - importedInResults, 0);

      return res.json({
        success: true,
        data: {
          start_date: systemStartDate,
          total_invoices: results.length, // total considerado para UI
          imported_count: importedInResults,
          pending,
          total_from_siigo: totalFromSiigo, // informativo
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Error en getImportSummary:', error.message);
      return res.status(500).json({ success: false, message: 'Error obteniendo resumen SIIGO', error: error.message });
    }
  },

  async getInvoices(req, res) {
    try {
      console.log('📋 Solicitud de facturas SIIGO recibida');

      const { page = 1, page_size = 20, start_date, created_start, enrich = 'true' } = req.query || {};
      const shouldEnrich = String(enrich).toLowerCase() !== 'false';

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
      let systemStartDate = start_date || created_start;

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

      // Obtener facturas desde SIIGO con rate limiting (paginando para traer >100 si aplica)
      // Respetar parámetros solicitados por el frontend y NO traer todas las páginas para evitar timeouts
      const realPage = Math.max(1, parseInt(page, 10) || 1);
      const realPageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20));

      const first = await siigoService.getInvoices({
        page: realPage,
        page_size: realPageSize,
        created_start: systemStartDate
      });

      const resultsToUse = Array.isArray(first?.results) ? [...first.results] : [];
      const totalResults = parseInt(first?.pagination?.total_results || resultsToUse.length, 10);
      let totalPages = Math.max(1, Math.ceil(totalResults / Math.max(1, realPageSize)));

      console.log(`✅ Página ${realPage}/${totalPages} — ${resultsToUse.length} facturas (created_start >= ${systemStartDate})`);

      // Filtrar facturas ya importadas (OPTIMIZADO: solo IDs de la página actual)
      console.log('🔍 Filtrando facturas ya importadas (optimizado)...');
      const pageIds = resultsToUse.map(inv => inv.id).filter(Boolean);
      let existingIds = new Set();
      if (pageIds.length > 0) {
        const placeholders = pageIds.map(() => '?').join(',');
        const [existingInvoices] = await pool.execute(
          `SELECT siigo_invoice_id FROM orders WHERE siigo_invoice_id IN (${placeholders})`,
          pageIds
        );
        existingIds = new Set(existingInvoices.map(inv => inv.siigo_invoice_id));
      }
      const filteredInvoices = resultsToUse.filter(inv => !existingIds.has(inv.id));

      console.log(`📊 Facturas obtenidas de SIIGO: ${resultsToUse.length}`);
      console.log(`📊 Facturas ya importadas en BD (en esta página): ${existingIds.size}`);
      console.log(`📊 Facturas disponibles para importar: ${filteredInvoices.length}`);

      // MOSTRAR TODAS LAS FACTURAS - Marcar las ya importadas pero no ocultarlas
      const allInvoicesWithStatus = resultsToUse.map(invoice => ({
        ...invoice,
        // Marcar si ya está importada
        is_imported: existingIds.has(invoice.id),
        import_status: existingIds.has(invoice.id) ? 'imported' : 'available'
      }));

      console.log('✅ Mostrando todas las facturas:', allInvoicesWithStatus.length);

      // Enriquecimiento opcional con información de cliente (controlado por parámetro enrich)
      let enrichedInvoices = allInvoicesWithStatus;
      if (shouldEnrich) {
        console.log('🔍 Enriqueciendo facturas con información completa de clientes...');
        const uniqueCustomerIds = [...new Set(filteredInvoices
          .filter(inv => inv.customer?.id)
          .map(inv => inv.customer.id))];

        console.log(`📋 Clientes únicos a consultar: ${uniqueCustomerIds.length}`);
        // Limitar enriquecimiento por página para evitar timeouts y respetar rate limit
        const MAX_ENRICH = parseInt(process.env.SIIGO_ENRICH_CUSTOMERS_PAGE_LIMIT || '5', 10);
        const limitedCustomerIds = uniqueCustomerIds.slice(0, MAX_ENRICH);
        if (uniqueCustomerIds.length > limitedCustomerIds.length) {
          console.log(`ℹ️ Enriqueciendo solo ${limitedCustomerIds.length}/${uniqueCustomerIds.length} clientes para esta página (configurable con SIIGO_ENRICH_CUSTOMERS_PAGE_LIMIT)`);
        }

        // Limitar concurrencia al consultar clientes para evitar 429
        const concurrency = parseInt(process.env.SIIGO_CUSTOMER_CONCURRENCY || '1', 10);
        async function processWithConcurrency(items, worker, max = concurrency) {
          let idx = 0;
          const workers = Array(Math.min(max, items.length)).fill(0).map(async () => {
            while (true) {
              const current = idx++;
              if (current >= items.length) break;
              const item = items[current];
              await worker(item, current);
            }
          });
          await Promise.all(workers);
        }

        // Pre-cargar información de clientes con concurrencia limitada (y aprovechando caché de siigoService)
        const customerInfoMap = new Map();
        await processWithConcurrency(
          limitedCustomerIds,
          async (id) => {
            try {
              const info = await siigoService.getCustomer(id);
              if (info) customerInfoMap.set(id, info);
            } catch (e) {
              console.warn(`⚠️ Error obteniendo cliente ${id}: ${e.message}`);
            }
          },
          concurrency
        );

        // Función para extraer nombre del cliente con múltiples fallbacks (igual que en siigoService)
        const extractCustomerName = (customer = {}, customerInfo = {}) => {
          if (customerInfo.commercial_name && customerInfo.commercial_name !== 'No aplica') return customerInfo.commercial_name;
          if (customerInfo.name && Array.isArray(customerInfo.name) && customerInfo.name.length >= 2) return customerInfo.name.join(' ').trim();
          if (customerInfo.person?.first_name) return `${customerInfo.person.first_name} ${customerInfo.person.last_name || ''}`.trim();
          if (customerInfo.company?.name) return customerInfo.company.name;
          if (customer?.commercial_name && customer.commercial_name !== 'No aplica') return customer.commercial_name;
          if (customer?.name) return customer.name;
          if (customerInfo.identification?.name) return customerInfo.identification.name;
          if (customer?.identification?.name) return customer.identification.name;
          return 'Cliente SIIGO';
        };


        enrichedInvoices = allInvoicesWithStatus.map((invoice) => {
          try {
            const cid = invoice.customer?.id;
            const customerInfo = cid ? customerInfoMap.get(cid) : undefined;

            // Usar la misma lógica de extracción que funciona en la importación, con guards
            const customerName = extractCustomerName(invoice.customer, customerInfo || {});
            const baseCustomer = invoice.customer
              ? { ...invoice.customer, commercial_name: customerName, name: customerName }
              : undefined;

            // Si no hay información adicional del cliente, devolver solo el nombre enriquecido
            if (!customerInfo) {
              return {
                ...invoice,
                ...(baseCustomer ? { customer: baseCustomer } : {})
              };
            }

            // Combinar detalles cuando sí hay customerInfo disponible
            return {
              ...invoice,
              customer: {
                ...(baseCustomer || {}),
                identification: customerInfo.identification ?? baseCustomer?.identification,
                person: customerInfo.person ?? baseCustomer?.person,
                company: customerInfo.company ?? baseCustomer?.company,
                contacts: customerInfo.contacts ?? baseCustomer?.contacts,
                address: customerInfo.address ?? baseCustomer?.address,
                phones: customerInfo.phones ?? baseCustomer?.phones,
                email: customerInfo.contacts?.[0]?.email || customerInfo.email || baseCustomer?.email,
                mail: customerInfo.contacts?.[0]?.email || customerInfo.email || baseCustomer?.mail
              },
              customer_info: {
                commercial_name: customerName,
                phone: customerInfo.phones?.[0]?.number || 'Sin teléfono',
                address: customerInfo.address?.address || 'Sin dirección',
                email: customerInfo.contacts?.[0]?.email || customerInfo.email || 'Sin email'
              }
            };
          } catch (error) {
            console.warn(`⚠️ Error enriqueciendo factura ${invoice.name}:`, error.message);
            return invoice;
          }
        });

        console.log(`✅ Enriquecimiento completado usando caché de ${limitedCustomerIds.length} clientes`);
      }

      res.json({
        success: true,
        data: {
          results: enrichedInvoices,
          pagination: first?.pagination || {
            page: parseInt(realPage),
            page_size: parseInt(realPageSize),
            total: totalResults,
            pages: totalPages
          },
          imported_count: existingIds.size
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
      console.log('═══════════════════════════════════════════');
      console.log('🔄 Solicitud de importación recibida');
      console.log('Body completo:', JSON.stringify(req.body, null, 2));
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('═══════════════════════════════════════════');

      const { invoice_ids, invoice_id, immediate, payment_method = 'transferencia', delivery_method = 'domicilio', sale_channel } = req.body;

      console.log('Parámetros extraídos:');
      console.log('  - invoice_ids:', invoice_ids);
      console.log('  - invoice_id:', invoice_id);
      console.log('  - immediate:', immediate);
      console.log('  - payment_method:', payment_method);
      console.log('  - delivery_method:', delivery_method);
      console.log('  - sale_channel:', sale_channel);

      // --- LOGICA DE IMPORTACIÓN INMEDIATA (POS) ---
      if (immediate && invoice_id) {
        console.log(`🚀 Importación INMEDIATA para factura ID: ${invoice_id}`);

        // 1. Obtener detalles de SIIGO
        const invoice = await siigoService.getInvoiceDetails(invoice_id);
        if (!invoice) {
          return res.status(404).json({ success: false, message: 'Factura no encontrada en SIIGO' });
        }

        // 2. Procesar a pedido
        const result = await siigoService.processInvoiceToOrder(invoice, payment_method, delivery_method, sale_channel);

        if (!result.success) {
          // Manejo de Race Condition: Si falla porque ya existe (auto-import ganó), recuperarlo
          if (result.isDuplicate || (result.message && (result.message.includes('ya existe') || result.message.includes('ya importada') || result.message.includes('duplicado')))) {
            console.log(`⚠️ Race condition detectada: Factura ${invoice_id} ya fue importada por auto-import. Recuperando...`);

            const [existing] = await pool.execute('SELECT * FROM orders WHERE siigo_invoice_id = ?', [invoice_id]);

            if (existing.length > 0) {
              const existingOrder = existing[0];
              // Actualizar método de pago si es diferente (auto-import usa default)
              if (payment_method && existingOrder.payment_method !== payment_method) {
                await pool.execute('UPDATE orders SET payment_method = ? WHERE id = ?', [payment_method, existingOrder.id]);
                existingOrder.payment_method = payment_method;
                console.log(`✅ Método de pago actualizado para pedido recuperado #${existingOrder.id}`);
              }

              return res.json({
                success: true,
                message: 'Pedido recuperado exitosamente (ya existía)',
                order: existingOrder
              });
            }
          }

          return res.status(400).json({ success: false, message: result.message });
        }

        // 3. Obtener el pedido completo de la BD
        const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ?', [result.orderId]);
        const order = orders[0];

        return res.json({
          success: true,
          message: 'Pedido importado exitosamente',
          order: order
        });
      }
      // ---------------------------------------------

      if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs de facturas requeridos'
        });
      }

      console.log(`📋 Importando ${invoice_ids.length} facturas con rate limiting...`);

      const result = await siigoService.importInvoices(invoice_ids, payment_method, delivery_method, sale_channel);

      res.json({
        success: true,
        message: `Importación completada: ${result.summary.successful}/${result.summary.total} exitosas`,
        results: result.results,
        summary: result.summary
      });

    } catch (error) {
      console.error('❌ Error en importación:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Error completo:', error);
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
      console.log(`� Obteniendo detalles de factura SIIGO: ${id}`);

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
  ,
  /**
   * POST /api/siigo/customers
   * Crear cliente en SIIGO desde el checkout (Persona/Empresa)
   * Payload esperado (flexible en nombres de campos):
   * {
   *   tipo | person_type: "persona" | "empresa" | "Person" | "Company",
   *   tipo_identificacion | id_type: "cedula" | "nit" | "CC" | "NIT",
   *   identificacion | identification: "123456789",
   *   nombres | first_name,
   *   apellidos | last_name,
   *   razon_social | company_name | name,
   *   email | correo,
   *   telefono | phone,
   *   direccion | address,
   *   ciudad | city (nombre) | city_code, state_code (opcional)
   * }
   */
  createCustomer: async (req, res) => {
    try {
      // Verificar SIIGO habilitado
      if (!(await isSiigoEnabled())) {
        return res.status(503).json({
          success: false,
          message: 'SIIGO deshabilitado en esta instancia'
        });
      }

      const b = req.body || {};

      // Normalización de tipo de cliente
      const rawTipo = (b.person_type || b.tipo || '').toString().toLowerCase();
      const personType = rawTipo.includes('emp') || rawTipo === 'company' ? 'Company' : 'Person';

      // Normalización de tipo de identificación -> mapear a códigos DIAN/SIIGO
      // CC -> '13', NIT -> '31', CE -> '22', TI -> '12', Pasaporte -> '41'
      const rawIdType = (b.id_type || b.tipo_identificacion || '').toString().trim().toLowerCase();
      function mapIdTypeToSiigoCode(v) {
        const s = String(v || '').trim().toUpperCase();
        switch (s) {
          case '31':
          case 'NIT': return '31'; // NIT
          case '13':
          case 'CC': return '13'; // Cédula de ciudadanía
          case '22':
          case 'CE': return '22'; // Cédula de extranjería
          case '12':
          case 'TI': return '12'; // Tarjeta de identidad
          case '41':
          case 'PA':
          case 'PASAPORTE': return '41'; // Pasaporte
          default: return s || '13';
        }
      }
      // idType es el CÓDIGO esperado por SIIGO; idTypeName solo para uso interno/respuesta
      const idType = mapIdTypeToSiigoCode(rawIdType);
      const idTypeName = idType === '31' ? 'NIT' : (idType === '13' ? 'CC' : idType);

      // Número de identificación
      const identification = (b.identification || b.identificacion || '').toString().replace(/\s+/g, '');
      if (!identification) {
        return res.status(400).json({ success: false, message: 'Identificación requerida' });
      }

      // DV para NIT (módulo 11) - Algoritmo oficial DIAN Colombia
      const computeNitCheckDigit = (nit) => {
        const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
        const nitStr = nit.toString().replace(/\D/g, '');
        const digits = nitStr.split(''); // NO reverse
        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
          const weight = weights[digits.length - 1 - i];
          sum += parseInt(digits[i], 10) * (weight || 0);
        }
        const mod = sum % 11;
        return mod > 1 ? (11 - mod) : mod;
      };
      const check_digit = idType === '31' ? String(computeNitCheckDigit(identification)) : undefined;

      // Nombres / Razón social
      const rawFirst = b.first_name || b.nombres || '';
      const rawLast = b.last_name || b.apellidos || '';
      const rawCompany = b.company_name || b.razon_social || b.name || '';

      let nameArray = [];
      if (personType === 'Person') {
        // Si no hay nombres separados pero viene "name", intentar dividir
        let first = (rawFirst || '').toString().trim();
        let last = (rawLast || '').toString().trim();
        if (!first && rawCompany) {
          const parts = rawCompany.toString().trim().split(/\s+/);
          first = parts.slice(0, -1).join(' ') || parts[0] || '';
          last = parts.slice(-1).join(' ') || '';
        }
        if (!first) return res.status(400).json({ success: false, message: 'Nombres requeridos para Persona' });
        nameArray = [first.toUpperCase(), (last || '').toUpperCase()];
      } else {
        const company = rawCompany.toString().trim();
        if (!company) return res.status(400).json({ success: false, message: 'Razón social requerida para Empresa' });
        nameArray = [company.toUpperCase()];
      }

      // Email
      const email = (b.email || b.correo || '').toString().trim() || undefined;

      // Teléfono
      const cleanPhone = (b.phone || b.telefono || '').toString().replace(/[^\d]/g, '');
      const phoneIndicative = b.phone_indicative || b.indicativo || (cleanPhone.startsWith('57') ? '' : '604');
      const phoneNumber = cleanPhone.startsWith('57') ? cleanPhone.slice(2) : cleanPhone;

      // Dirección
      const addressText = (b.address || b.direccion || '').toString().trim();

      // Ciudad (códigos SIIGO): preferir state_code + city_code; luego objeto city {state_code, city_code}; luego map por nombre; fallback Medellín.
      const cityName = (b.city || b.ciudad || '').toString().toLowerCase();
      const rawCityObj = (typeof b.city === 'object' && b.city) || {};
      const providedCityCode = (b.city_code || b.cityCode || rawCityObj.city_code || rawCityObj.code || '').toString();
      const providedStateCode = (b.state_code || b.stateCode || rawCityObj.state_code || '').toString();

      async function resolveCity() {
        // 1) Si vienen explícitos
        if (providedCityCode && providedStateCode) {
          return { country_code: 'CO', state_code: providedStateCode, city_code: providedCityCode };
        }
        // 2) Si viene objeto city con códigos
        if (rawCityObj && rawCityObj.state_code && (rawCityObj.city_code || rawCityObj.code)) {
          return {
            country_code: 'CO',
            state_code: String(rawCityObj.state_code),
            city_code: String(rawCityObj.city_code || rawCityObj.code)
          };
        }
        // 3) Intentar resolver por nombre usando DB (tabla siigo_cities)
        try {
          const dbSvc = require('../services/siigoCitiesService');
          const fromDb = await dbSvc.resolveCityByName(cityName);
          if (fromDb) {
            return {
              country_code: fromDb.country_code || 'CO',
              state_code: fromDb.state_code,
              city_code: String(fromDb.city_code || fromDb.code)
            };
          }
        } catch (e) {
          console.warn('⚠️ resolveCity DB falló:', e.message);
        }
        // 4) Intentar Excel completo
        try {
          const loader = require('../services/siigoCitiesLoader');
          const fromExcel = await loader.resolveCityByName(cityName);
          if (fromExcel) {
            return {
              country_code: fromExcel.country_code || 'CO',
              state_code: fromExcel.state_code,
              city_code: String(fromExcel.city_code || fromExcel.code)
            };
          }
        } catch (e) { }
        // 5) Fallback al catálogo mínimo local
        try {
          const { searchCities } = require('../services/siigoCitiesCO');
          const found = searchCities(cityName)[0];
          if (found) {
            return { country_code: 'CO', state_code: found.state_code, city_code: found.city_code };
          }
        } catch { }
        // 6) Fallback definitivo Medellín
        return { country_code: 'CO', state_code: '05', city_code: '05001' };
      }

      const cityObj = await resolveCity();

      // Responsabilidad fiscal & IVA (defaults compatibles)
      const fiscal_responsibilities = Array.isArray(b.fiscal_responsibilities) && b.fiscal_responsibilities.length > 0
        ? b.fiscal_responsibilities
        : [{ code: 'R-99-PN' }];
      const iva_responsible = typeof b.iva_responsible === 'boolean' ? b.iva_responsible : false;

      // Contacto principal (opcional)
      const contactFirst = personType === 'Person' ? nameArray[0] : (b.contact_first_name || '').toString().trim();
      const contactLast = personType === 'Person' ? (nameArray[1] || '') : (b.contact_last_name || '').toString().trim();

      // Construir payload SIIGO
      const payload = {
        person_type: personType,
        id_type: idType,
        identification,
        ...(check_digit !== undefined ? { check_digit } : {}),
        name: nameArray,
        branch_office: b.branch_office || 0,
        active: true,
        address: addressText
          ? { address: addressText, city: cityObj }
          : undefined,
        phones: phoneNumber ? [{ indicative: phoneIndicative || undefined, number: phoneNumber }] : undefined,
        contacts: email ? [{ first_name: contactFirst || undefined, last_name: contactLast || undefined, email }] : undefined,
        email: email || undefined,
        fiscal_responsibilities,
        iva_responsible
      };

      // Llamar servicio SIIGO
      const created = await siigoService.createCustomer(payload);

      // Guardar / actualizar cliente en la base de datos local automáticamente
      try {
        await customerService.saveCustomer(created);
        console.log('💾 Cliente SIIGO sincronizado en BD local:', created?.id);
      } catch (e) {
        console.warn('⚠️ No se pudo sincronizar cliente en BD local (continuando):', e.message);
      }

      // Responder al frontend de checkout con datos clave para seleccionar inmediatamente
      return res.status(201).json({
        success: true,
        message: 'Cliente creado en SIIGO',
        data: {
          id: created?.id || created?._id || null,
          person_type: created?.person_type || personType,
          id_type: created?.id_type || idType,
          identification: created?.identification || identification,
          check_digit: created?.check_digit ?? check_digit,
          name: created?.name || nameArray,
          email: created?.email || email || created?.contacts?.[0]?.email || null,
          phones: created?.phones || payload.phones || [],
          address: created?.address || payload.address || null,
          raw: created
        }
      });
    } catch (error) {
      console.error('❌ Error creando cliente SIIGO:', error.message);

      // Manejo específico para "already_exists"
      const isAlreadyExists = error.response?.data?.Errors?.some(e => e.Code === 'already_exists');
      if (isAlreadyExists) {
        console.log(`⚠️ Cliente ya existe (${identification}), intentando recuperar...`);
        try {
          const existing = await siigoService.getCustomerByIdentification(identification);
          if (existing) {
            return res.status(200).json({
              success: true,
              message: 'El cliente ya existe en SIIGO. Se ha seleccionado automáticamente.',
              data: {
                id: existing.id,
                person_type: existing.person_type,
                id_type: existing.id_type,
                identification: existing.identification,
                check_digit: existing.check_digit,
                name: existing.name,
                email: existing.email || existing.contacts?.[0]?.email,
                phones: existing.phones,
                address: existing.address,
                raw: existing
              },
              existing: true
            });
          }
        } catch (fetchError) {
          console.warn('⚠️ Falló recuperación de cliente existente:', fetchError.message);
        }
      }

      const status = error.response?.status || 500;
      // Mensaje de SIIGO si disponible
      const apiMsg = error.response?.data?.message || error.response?.data?.Errors || error.response?.data || error.message;
      return res.status(status === 401 ? 503 : (status >= 400 && status < 600 ? status : 500)).json({
        success: false,
        message: typeof apiMsg === 'string' ? apiMsg : 'Error creando cliente en SIIGO',
        error: typeof apiMsg === 'string' ? undefined : apiMsg
      });
    }
  },
  /**
   * GET /api/siigo/cities?search=
   * Autocomplete simple de ciudades (códigos SIIGO)
   */
  listCities: async (req, res) => {
    try {
      const { search = '' } = req.query || {};
      const q = typeof search === 'string' ? search : String(search || '');
      const variants = [q];
      // Intento de corregir mojibake (latin1->utf8) si llegó mal codificado desde algún cliente
      try {
        const fixed = Buffer.from(q, 'latin1').toString('utf8');
        if (fixed && fixed !== q) variants.push(fixed);
      } catch { }
      let data = [];

      const tryVariant = async (v) => {
        // 1) DB
        try {
          const dbSvc = require('../services/siigoCitiesService');
          const r = await dbSvc.searchCities(v);
          console.log(`[SIIGO:CITIES] query="${v}" (db) -> ${Array.isArray(r) ? r.length : 0} resultados`);
          if (Array.isArray(r) && r.length) return r;
        } catch (e) {
          console.warn('⚠️ Búsqueda en DB falló:', e.message);
        }
        // 2) Excel
        try {
          const loader = require('../services/siigoCitiesLoader');
          const r = await loader.searchCitiesExcel(v);
          console.log(`[SIIGO:CITIES] query="${v}" (excel) -> ${Array.isArray(r) ? r.length : 0} resultados`);
          if (Array.isArray(r) && r.length) return r;
        } catch (e) {
          console.warn('⚠️ Búsqueda Excel falló:', e.message);
        }
        // 3) Local mínimo
        try {
          const svc = require('../services/siigoCitiesCO');
          const r = svc.searchCities(v);
          console.log(`[SIIGO:CITIES] query="${v}" (local) -> ${Array.isArray(r) ? r.length : 0} resultados`);
          if (Array.isArray(r) && r.length) return r;
        } catch { }
        return [];
      };

      for (const v of variants) {
        data = await tryVariant(v);
        if (Array.isArray(data) && data.length) break;
      }
      if (Array.isArray(data) && data.length > 0) {
        const s = data[0];
        console.log(`[SIIGO:CITIES] primer resultado: ${s.city_name} — ${s.state_name} · ${s.city_code}/${s.state_code}`);
      } else {
        console.log(`[SIIGO:CITIES] sin resultados para query="${search}"`);
      }
      return res.json({ success: true, data });
    } catch (error) {
      console.error('❌ Error listando ciudades SIIGO:', error.message);
      return res.status(500).json({ success: false, message: 'Error listando ciudades', error: error.message });
    }
  }
};

module.exports = siigoController;

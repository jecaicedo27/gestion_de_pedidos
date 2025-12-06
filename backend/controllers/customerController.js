const customerUpdateService = require('../services/customerUpdateService');
const siigoService = require('../services/siigoService');
const { query } = require('../config/database');

class CustomerController {
  // Búsqueda rápida de clientes por NIT/Nombre (para autocompletar en crédito)
  async searchCustomersQuick(req, res) {
    try {
      const { search = '' } = req.query;
      if (!search || String(search).trim().length < 2) {
        return res.json({ success: true, customers: [] });
      }

      const term = `%${search.trim()}%`;
      const customers = await query(`
        SELECT id, siigo_id, name, commercial_name, identification, document_type, phone, email
        FROM customers
        WHERE identification LIKE ? OR name LIKE ? OR commercial_name LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
      `, [term, term, term]);

      return res.json({ success: true, customers });
    } catch (error) {
      console.error('❌ Error en búsqueda rápida de clientes:', error.message);
      return res.status(500).json({ success: false, message: 'Error en búsqueda de clientes' });
    }
  }
  // Sincronización completa de todos los clientes desde SIIGO (paginado hasta max_pages)
  // Soporta ejecución en segundo plano para evitar 504 detrás de proxy (usar GET o ?async=true)
  async fullSyncAllCustomers(req, res) {
    try {
      const maxPages = Math.min(parseInt(req.query.max_pages || req.body?.max_pages || '200', 10), 500);
      const runInBackground = req.method === 'GET' || String(req.query.async || '').toLowerCase() === 'true';
      const jobId = `full-sync-${Date.now()}`;
      
      console.log(`👥 Iniciando sincronización COMPLETA de clientes desde SIIGO (máx ${maxPages} páginas)...`);
      console.log(`🧰 Modo: ${runInBackground ? 'background (async)' : 'síncrono (esperando respuesta)'}`);

      // Si se solicita en background (GET o async=true), responder inmediatamente y ejecutar en segundo plano
      if (runInBackground) {
        try {
          res.json({
            success: true,
            message: 'Sincronización iniciada en segundo plano',
            data: { jobId, maxPages }
          });
        } catch {
          // Ignorar errores al responder (por si el cliente cierra conexión)
        }

        // Ejecutar proceso en background
        setImmediate(async () => {
          const io = global.io;
          const emit = (event, payload) => {
            try { io && io.to && io.to('siigo-updates').emit(event, payload); } catch {}
          };

          try {
            emit('customers_full_sync_started', { jobId, maxPages, startedAt: new Date().toISOString() });

            const siigoCustomers = await siigoService.getAllCustomers(maxPages);
            console.log(`📊 Recibidos ${siigoCustomers.length} clientes desde SIIGO`);

            const existingRows = await query(`SELECT siigo_id FROM customers WHERE siigo_id IS NOT NULL`);
            const existing = new Set(existingRows.map(r => r.siigo_id));

            let processed = 0;
            let created = 0;
            let updated = 0;
            let errors = 0;

            for (const c of siigoCustomers) {
              try {
                const extracted = customerUpdateService.extractCompleteCustomerData(c);
                const beforeExists = existing.has(c.id);
                await customerUpdateService.upsertCustomer(c.id, extracted);
                processed++;
                if (!beforeExists) {
                  existing.add(c.id);
                  created++;
                } else {
                  updated++;
                }
              } catch (e) {
                console.error('❌ Error upsert cliente', c?.id, e.message);
                errors++;
              }

              // Emitir progreso cada 100 registros
              if (processed % 100 === 0) {
                emit('customers_full_sync_progress', {
                  jobId,
                  processed,
                  created,
                  updated,
                  errors,
                  totalFetched: siigoCustomers.length,
                  timestamp: new Date().toISOString()
                });
              }
            }

            emit('customers_full_sync_done', {
              jobId,
              processed,
              created,
              updated,
              errors,
              totalFetched: siigoCustomers.length,
              finishedAt: new Date().toISOString()
            });

            console.log('✅ Sincronización completa finalizada (background)');
          } catch (bgError) {
            console.error('❌ Error en fullSyncAllCustomers (background):', bgError.message);
            emit('customers_full_sync_error', {
              jobId,
              message: 'Error en sincronización completa',
              error: bgError.message,
              timestamp: new Date().toISOString()
            });
          }
        });

        return; // ya respondimos
      }

      // Modo síncrono (POST recomendado): procesar y esperar
      const siigoCustomers = await siigoService.getAllCustomers(maxPages);
      console.log(`📊 Recibidos ${siigoCustomers.length} clientes desde SIIGO`);

      const existingRows = await query(`SELECT siigo_id FROM customers WHERE siigo_id IS NOT NULL`);
      const existing = new Set(existingRows.map(r => r.siigo_id));

      let processed = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const c of siigoCustomers) {
        try {
          const extracted = customerUpdateService.extractCompleteCustomerData(c);
          const beforeExists = existing.has(c.id);
          await customerUpdateService.upsertCustomer(c.id, extracted);
          processed++;
          if (!beforeExists) {
            existing.add(c.id);
            created++;
          } else {
            updated++;
          }
        } catch (e) {
          console.error('❌ Error upsert cliente', c?.id, e.message);
          errors++;
        }
      }

      return res.json({
        success: true,
        message: 'Sincronización completa finalizada',
        data: { processed, created, updated, errors, totalFetched: siigoCustomers.length }
      });
    } catch (error) {
      console.error('❌ Error en fullSyncAllCustomers:', error.message);
      return res.status(500).json({ success: false, message: 'Error en sincronización completa', error: error.message });
    }
  }
  
  // Actualizar todos los clientes desde SIIGO
  async updateAllCustomers(req, res) {
    try {
      console.log('🔄 Iniciando actualización masiva de clientes...');
      
      const result = await customerUpdateService.updateAllCustomersFromSiigo();
      
      res.json({
        success: true,
        message: result.message,
        data: {
          updatedCount: result.updatedCount,
          errorCount: result.errorCount,
          processedCustomers: result.processedCustomers
        }
      });
      
    } catch (error) {
      console.error('❌ Error en actualización masiva de clientes:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar clientes',
        error: error.message
      });
    }
  }

  // Actualizar un cliente específico
  async updateSingleCustomer(req, res) {
    try {
      const { siigoCustomerId } = req.params;
      
      if (!siigoCustomerId) {
        return res.status(400).json({
          success: false,
          message: 'siigoCustomerId es requerido'
        });
      }

      console.log(`🔄 Actualizando cliente específico: ${siigoCustomerId}`);
      
      const result = await customerUpdateService.updateSingleCustomer(siigoCustomerId);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          ordersUpdated: result.ordersUpdated
        }
      });
      
    } catch (error) {
      console.error(`❌ Error actualizando cliente ${req.params.siigoCustomerId}:`, error.message);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar cliente específico',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de clientes (a nivel de tabla customers)
  async getCustomerStats(req, res) {
    try {
      const customersInTable = await query(`
        SELECT COUNT(*) as count FROM customers
      `);

      const customersWithCommercialName = await query(`
        SELECT COUNT(*) as count FROM customers 
        WHERE commercial_name IS NOT NULL 
          AND TRIM(commercial_name) <> '' 
          AND LOWER(TRIM(commercial_name)) <> 'no aplica'
      `);

      const customersWithoutCommercialName = await query(`
        SELECT COUNT(*) as count FROM customers 
        WHERE commercial_name IS NULL 
           OR TRIM(commercial_name) = ''
           OR LOWER(TRIM(commercial_name)) = 'no aplica'
      `);

      const customersWithIncompleteData = await query(`
        SELECT COUNT(*) as count FROM customers 
        WHERE (phone IS NULL OR TRIM(phone) = '')
           OR (address IS NULL OR TRIM(address) = '')
           OR (city IS NULL OR TRIM(city) = '')
      `);

      res.json({
        success: true,
        data: {
          customersInTable: customersInTable[0].count,
          customersWithCommercialName: customersWithCommercialName[0].count,
          customersWithoutCommercialName: customersWithoutCommercialName[0].count,
          customersWithIncompleteData: customersWithIncompleteData[0].count,
          completionPercentage: customersInTable[0].count > 0 ?
            Math.round((customersWithCommercialName[0].count / customersInTable[0].count) * 100) : 0
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de clientes:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  }

  // Obtener lista de clientes
  async getCustomers(req, res) {
    try {
      const { page = 1, limit = 50, search = '' } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '';
      let params = [];

      if (search) {
        whereClause = 'WHERE name LIKE ? OR commercial_name LIKE ? OR identification LIKE ?';
        const searchPattern = `%${search}%`;
        params = [searchPattern, searchPattern, searchPattern];
      }

      const customers = await query(`
        SELECT 
          customers.id, customers.siigo_id, customers.name, customers.commercial_name,
          customers.identification, customers.document_type,
          customers.phone, customers.address, customers.city, customers.state as department,
          customers.country, customers.email, customers.active, customers.created_at, customers.updated_at,
          COALESCE(stats.orders_count, 0) AS orders_count,
          COALESCE(stats.total_spent, 0) AS lifetime_total,
          stats.first_order_at,
          stats.last_order_at
        FROM customers
        LEFT JOIN (
          SELECT 
            COALESCE(o.siigo_customer_id, o.customer_identification) AS cust_key,
            COUNT(*) AS orders_count,
            SUM(o.total_amount) AS total_spent,
            MIN(o.created_at) AS first_order_at,
            MAX(o.created_at) AS last_order_at
          FROM orders o
          GROUP BY cust_key
        ) AS stats
          ON stats.cust_key = COALESCE(customers.siigo_id, customers.identification)
        ${whereClause}
        ORDER BY customers.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      const totalCount = await query(`
        SELECT COUNT(*) as count FROM customers ${whereClause}
      `, params);

      res.json({
        success: true,
        data: {
          customers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount[0].count,
            pages: Math.ceil(totalCount[0].count / limit)
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo clientes:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener clientes',
        error: error.message
      });
    }
  }

  // Obtener cliente específico
  async getCustomer(req, res) {
    try {
      const { id } = req.params;

      const customer = await query(`
        SELECT * FROM customers WHERE id = ?
      `, [id]);

      if (customer.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // También obtener pedidos relacionados
      const relatedOrders = await query(`
        SELECT id, order_number, customer_name, commercial_name, total_amount, 
               status, created_at, siigo_invoice_id
        FROM orders 
        WHERE siigo_customer_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `, [customer[0].siigo_id]);

      res.json({
        success: true,
        data: {
          customer: customer[0],
          relatedOrders
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo cliente:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener cliente',
        error: error.message
      });
    }
  }

  // Crear nuevo cliente
  async createCustomer(req, res) {
    try {
      const {
        siigo_id,
        document_type,
        identification,
        check_digit,
        name,
        commercial_name,
        phone,
        address,
        city,
        state,
        country = 'Colombia',
        email
      } = req.body;

      // Validaciones básicas
      if (!document_type || !identification || !name) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: document_type, identification, name'
        });
      }

      // Verificar que no exista ya
      if (siigo_id) {
        const existing = await query(`
          SELECT id FROM customers WHERE siigo_id = ?
        `, [siigo_id]);

        if (existing.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un cliente con este siigo_id'
          });
        }
      }

      const result = await query(`
        INSERT INTO customers (
          siigo_id, document_type, identification, check_digit, name, commercial_name,
          phone, address, city, state, country, email, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [
        siigo_id,
        document_type,
        identification,
        check_digit,
        name,
        commercial_name,
        phone,
        address,
        city,
        state,
        country,
        email
      ]);

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: {
          id: result.insertId
        }
      });

    } catch (error) {
      console.error('❌ Error creando cliente:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al crear cliente',
        error: error.message
      });
    }
  }

  // Actualizar cliente existente
  async updateCustomer(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;

      // Remover campos que no se pueden actualizar
      delete updateFields.id;
      delete updateFields.created_at;

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay campos para actualizar'
        });
      }

      // Construir query dinámicamente
      const setClause = Object.keys(updateFields)
        .map(field => `${field} = ?`)
        .join(', ');

      const values = [...Object.values(updateFields), id];

      await query(`
        UPDATE customers SET ${setClause}, updated_at = NOW() WHERE id = ?
      `, values);

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error actualizando cliente:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar cliente',
        error: error.message
      });
    }
  }

  // Eliminar cliente (soft delete)
  async deleteCustomer(req, res) {
    try {
      const { id } = req.params;

      await query(`
        UPDATE customers SET active = 0, updated_at = NOW() WHERE id = ?
      `, [id]);

      res.json({
        success: true,
        message: 'Cliente desactivado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error eliminando cliente:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar cliente',
        error: error.message
      });
    }
  }
}

module.exports = new CustomerController();

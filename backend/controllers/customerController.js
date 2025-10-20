const customerUpdateService = require('../services/customerUpdateService');
const { query } = require('../config/database');

class CustomerController {
  
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

  // Obtener estadísticas de clientes
  async getCustomerStats(req, res) {
    try {
      // Contar clientes con datos completos vs incompletos
      const totalOrders = await query(`
        SELECT COUNT(*) as count FROM orders WHERE siigo_customer_id IS NOT NULL
      `);

      const ordersWithCommercialName = await query(`
        SELECT COUNT(*) as count FROM orders 
        WHERE siigo_customer_id IS NOT NULL AND commercial_name IS NOT NULL
      `);

      const ordersWithoutCommercialName = await query(`
        SELECT COUNT(*) as count FROM orders 
        WHERE siigo_customer_id IS NOT NULL AND commercial_name IS NULL
      `);

      const ordersWithIncompleteData = await query(`
        SELECT COUNT(*) as count FROM orders 
        WHERE siigo_customer_id IS NOT NULL 
        AND (
          commercial_name IS NULL 
          OR customer_identification IS NULL 
          OR customer_phone IS NULL 
          OR customer_address IS NULL
        )
      `);

      const uniqueCustomers = await query(`
        SELECT COUNT(DISTINCT siigo_customer_id) as count FROM orders 
        WHERE siigo_customer_id IS NOT NULL
      `);

      const customersInTable = await query(`
        SELECT COUNT(*) as count FROM customers
      `);

      res.json({
        success: true,
        data: {
          totalOrdersWithSiigoId: totalOrders[0].count,
          ordersWithCommercialName: ordersWithCommercialName[0].count,
          ordersWithoutCommercialName: ordersWithoutCommercialName[0].count,
          ordersWithIncompleteData: ordersWithIncompleteData[0].count,
          uniqueSiigoCustomers: uniqueCustomers[0].count,
          customersInTable: customersInTable[0].count,
          completionPercentage: totalOrders[0].count > 0 ? 
            Math.round((ordersWithCommercialName[0].count / totalOrders[0].count) * 100) : 0
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
        SELECT id, siigo_id, name, commercial_name, identification, document_type,
               phone, address, city, state, country, email, active, created_at, updated_at
        FROM customers 
        ${whereClause}
        ORDER BY created_at DESC
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

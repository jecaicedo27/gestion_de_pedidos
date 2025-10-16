const { query } = require('../config/database');
const siigoService = require('./siigoService');

class CustomerService {
  // Sincronizar clientes desde SIIGO
  static async syncCustomersFromSiigo() {
    try {
      console.log('🔄 Iniciando sincronización de clientes desde SIIGO...');
      
      // Obtener token de SIIGO
      const token = await siigoService.authenticate();
      if (!token) {
        throw new Error('No se pudo obtener token de SIIGO');
      }

      let page = 1;
      let totalSynced = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        try {
          console.log(`📄 Obteniendo página ${page} de clientes...`);
          
          const response = await fetch(`https://api.siigo.com/v1/customers?page_size=100&page=${page}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.error(`❌ Error en página ${page}:`, response.status, response.statusText);
            if (response.status === 401) {
              // Token expirado, intentar renovar
              const newToken = await siigoService.authenticate();
              if (newToken) {
                continue; // Reintentar con nuevo token
              }
            }
            break;
          }

          const data = await response.json();
          
          if (!data.results || data.results.length === 0) {
            hasMorePages = false;
            break;
          }

          // Procesar clientes de esta página
          for (const customer of data.results) {
            try {
              await this.saveCustomer(customer);
              totalSynced++;
              
              if (totalSynced % 50 === 0) {
                console.log(`✅ Sincronizados ${totalSynced} clientes...`);
              }
            } catch (error) {
              console.error('❌ Error guardando cliente:', customer.id, error.message);
            }
          }

          // Verificar si hay más páginas
          hasMorePages = data.pagination && data.pagination.total_pages > page;
          page++;

          // Rate limiting - esperar entre requests
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error procesando página ${page}:`, error.message);
          break;
        }
      }

      console.log(`✅ Sincronización completada: ${totalSynced} clientes sincronizados`);
      return { success: true, totalSynced };
      
    } catch (error) {
      console.error('❌ Error en sincronización de clientes:', error);
      return { success: false, error: error.message };
    }
  }

  // Guardar o actualizar cliente en la base de datos
  static async saveCustomer(siigoCustomer) {
    try {
      const customerData = {
        siigo_id: siigoCustomer.id,
        document_type: siigoCustomer.person_type === 'Person' ? 'CC' : 'NIT',
        identification: siigoCustomer.identification || siigoCustomer.id,
        check_digit: siigoCustomer.check_digit || null,
        name: siigoCustomer.name || siigoCustomer.commercial_name || 'Sin nombre',
        commercial_name: siigoCustomer.commercial_name || null,
        phone: this.extractPhone(siigoCustomer.phones),
        address: this.extractAddress(siigoCustomer.address),
        city: siigoCustomer.address && siigoCustomer.address[0] ? siigoCustomer.address[0].city?.name : null,
        state: siigoCustomer.address && siigoCustomer.address[0] ? siigoCustomer.address[0].city?.state_name : null,
        email: this.extractEmail(siigoCustomer.contacts),
        active: siigoCustomer.active !== false
      };

      // Verificar si el cliente ya existe
      const existing = await query(
        'SELECT id FROM customers WHERE siigo_id = ?',
        [customerData.siigo_id]
      );

      if (existing.length > 0) {
        // Actualizar cliente existente
        await query(`
          UPDATE customers SET
            document_type = ?,
            identification = ?,
            check_digit = ?,
            name = ?,
            commercial_name = ?,
            phone = ?,
            address = ?,
            city = ?,
            state = ?,
            email = ?,
            active = ?,
            updated_at = NOW()
          WHERE siigo_id = ?
        `, [
          customerData.document_type,
          customerData.identification,
          customerData.check_digit,
          customerData.name,
          customerData.commercial_name,
          customerData.phone,
          customerData.address,
          customerData.city,
          customerData.state,
          customerData.email,
          customerData.active,
          customerData.siigo_id
        ]);
      } else {
        // Insertar nuevo cliente
        await query(`
          INSERT INTO customers (
            siigo_id, document_type, identification, check_digit, name,
            commercial_name, phone, address, city, state, email, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          customerData.siigo_id,
          customerData.document_type,
          customerData.identification,
          customerData.check_digit,
          customerData.name,
          customerData.commercial_name,
          customerData.phone,
          customerData.address,
          customerData.city,
          customerData.state,
          customerData.email,
          customerData.active
        ]);
      }

      return { success: true };
    } catch (error) {
      console.error('Error guardando cliente:', error);
      throw error;
    }
  }

  // Extraer teléfono principal
  static extractPhone(phones) {
    if (!phones || !Array.isArray(phones) || phones.length === 0) return null;
    
    // Buscar teléfono móvil primero, luego cualquier teléfono
    const mobilePhone = phones.find(p => p.indicative && p.number);
    if (mobilePhone) {
      return `${mobilePhone.indicative}${mobilePhone.number}`;
    }
    
    const anyPhone = phones.find(p => p.number);
    return anyPhone ? anyPhone.number : null;
  }

  // Extraer dirección principal
  static extractAddress(addresses) {
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) return null;
    
    const mainAddress = addresses[0];
    return mainAddress.address || null;
  }

  // Extraer email principal
  static extractEmail(contacts) {
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return null;
    
    const emailContact = contacts.find(c => c.email);
    return emailContact ? emailContact.email : null;
  }

  // Buscar clientes por nombre o identificación
  static async searchCustomers(searchTerm, limit = 20) {
    try {
      const searchQuery = `%${searchTerm}%`;
      
      const customers = await query(`
        SELECT 
          id,
          siigo_id,
          document_type,
          identification,
          name,
          commercial_name,
          phone,
          address,
          city,
          state,
          email,
          active
        FROM customers 
        WHERE active = TRUE AND (
          name LIKE ? OR 
          commercial_name LIKE ? OR
          identification LIKE ?
        )
        ORDER BY 
          CASE 
            WHEN name LIKE ? THEN 1
            WHEN commercial_name LIKE ? THEN 2
            WHEN identification LIKE ? THEN 3
            ELSE 4
          END,
          name ASC
        LIMIT ?
      `, [
        searchQuery, searchQuery, searchQuery, // WHERE conditions
        searchQuery, searchQuery, searchQuery, // ORDER BY conditions
        limit
      ]);

      return customers;
    } catch (error) {
      console.error('Error buscando clientes:', error);
      throw error;
    }
  }

  // Obtener cliente por ID
  static async getCustomerById(customerId) {
    try {
      const customers = await query(`
        SELECT 
          id,
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
          email,
          active,
          created_at,
          updated_at
        FROM customers 
        WHERE id = ? AND active = TRUE
      `, [customerId]);

      return customers[0] || null;
    } catch (error) {
      console.error('Error obteniendo cliente:', error);
      throw error;
    }
  }

  // Obtener estadísticas de clientes
  static async getCustomerStats() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN active = TRUE THEN 1 END) as active_customers,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_customers_30_days,
          MAX(updated_at) as last_sync
        FROM customers
      `);

      return stats[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas de clientes:', error);
      throw error;
    }
  }

  // Crear cliente manualmente (si no existe en SIIGO)
  static async createCustomer(customerData) {
    try {
      const result = await query(`
        INSERT INTO customers (
          siigo_id, document_type, identification, check_digit, name,
          commercial_name, phone, address, city, state, country, email, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerData.siigo_id || `MANUAL_${Date.now()}`,
        customerData.document_type,
        customerData.identification,
        customerData.check_digit || null,
        customerData.name,
        customerData.commercial_name || null,
        customerData.phone || null,
        customerData.address || null,
        customerData.city || null,
        customerData.state || null,
        customerData.country || 'Colombia',
        customerData.email || null,
        true
      ]);

      return result.insertId;
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    }
  }
}

module.exports = CustomerService;

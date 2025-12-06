const { query } = require('../config/database');
const SiigoService = require('./siigoService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class CustomerUpdateService {
  constructor() {
    this.siigoService = SiigoService;
    this.processedCustomers = new Set();
    this.updatedCount = 0;
    this.errorCount = 0;
    this.logInterval = 10; // Log cada 10 clientes procesados
  }

  // Función para sanitizar texto
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;
    
    try {
      return text
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de control
        .replace(/[\uD800-\uDFFF]/g, '') // Remover surrogates sin pareja
        .replace(/[^\u0000-\uFFFF]/g, '') // Remover caracteres fuera del BMP
        .trim();
    } catch (error) {
      console.warn('Error sanitizando texto:', error.message);
      return String(text || '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
    }
  }

  // Función principal para actualizar todos los clientes desde SIIGO
  async updateAllCustomersFromSiigo() {
    console.log('🔄 Iniciando actualización masiva de clientes desde SIIGO...');
    
    try {
      // 1. Obtener todos los pedidos que tienen siigo_customer_id pero no tienen datos completos
      const ordersToUpdate = await query(`
        SELECT DISTINCT 
          id, order_number, siigo_customer_id, customer_name, 
          commercial_name, customer_phone, customer_address, 
          customer_identification, customer_id_type, customer_email,
          customer_city, customer_department, customer_country
        FROM orders 
        WHERE siigo_customer_id IS NOT NULL 
        AND (
          commercial_name IS NULL 
          OR customer_identification IS NULL 
          OR customer_phone IS NULL 
          OR customer_address IS NULL
        )
        ORDER BY created_at DESC
      `);

      console.log(`📊 Encontrados ${ordersToUpdate.length} pedidos para actualizar`);

      if (ordersToUpdate.length === 0) {
        return {
          success: true,
          message: 'Todos los clientes ya están actualizados',
          updatedCount: 0,
          errorCount: 0
        };
      }

      // 2. Agrupar por siigo_customer_id para evitar consultas duplicadas
      const uniqueCustomerIds = [...new Set(ordersToUpdate.map(order => order.siigo_customer_id))];
      console.log(`👥 ${uniqueCustomerIds.length} clientes únicos a procesar`);

      // 3. Procesar cada cliente único
      for (let i = 0; i < uniqueCustomerIds.length; i++) {
        const customerId = uniqueCustomerIds[i];
        
        try {
          // Obtener datos completos del cliente desde SIIGO
          const customerData = await this.siigoService.getCustomer(customerId);
          
          if (!customerData) {
            console.log(`⚠️ No se pudo obtener datos para cliente ${customerId}`);
            this.errorCount++;
            continue;
          }

          // Extraer todos los datos del cliente
          const extractedData = this.extractCompleteCustomerData(customerData);
          
          // Actualizar todos los pedidos de este cliente
          const ordersForCustomer = ordersToUpdate.filter(order => order.siigo_customer_id === customerId);
          
          for (const order of ordersForCustomer) {
            await this.updateOrderWithCustomerData(order.id, extractedData);
            this.updatedCount++;
          }

          // También actualizar o crear en tabla customers
          await this.upsertCustomer(customerId, extractedData);

          // Log de progreso
          if ((i + 1) % this.logInterval === 0 || i === uniqueCustomerIds.length - 1) {
            console.log(`📈 Progreso: ${i + 1}/${uniqueCustomerIds.length} clientes procesados`);
          }

          // Pausa pequeña para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`❌ Error procesando cliente ${customerId}:`, error.message);
          this.errorCount++;
          continue;
        }
      }

      // 4. También poblar tabla customers con clientes que no están
      await this.populateCustomersTable();

      console.log(`✅ Actualización completada: ${this.updatedCount} pedidos actualizados, ${this.errorCount} errores`);

      return {
        success: true,
        message: `Actualización completada exitosamente`,
        updatedCount: this.updatedCount,
        errorCount: this.errorCount,
        processedCustomers: uniqueCustomerIds.length
      };

    } catch (error) {
      console.error('❌ Error en actualización masiva:', error.message);
      throw error;
    }
  }

  // Extraer datos completos del cliente desde SIIGO
  extractCompleteCustomerData(customerData) {
    console.log('🔍 Extrayendo datos completos del cliente...');

    // Normalizar tipo de documento a códigos cortos para evitar overflow en DB
    const normalizeIdType = (idTypeObj) => {
      try {
        const name = (idTypeObj && (idTypeObj.name || idTypeObj.code || idTypeObj)) || '';
        const s = String(name).toLowerCase();
        if (s.includes('nit')) return 'NIT';
        if (s.includes('cédula de ciudadanía') || s.includes('cedula de ciudadania') || s === 'cc' || s.includes('c.c')) return 'CC';
        if (s.includes('cédula de extran') || s.includes('cedula de extran') || s === 'ce') return 'CE';
        if (s.includes('tarjeta de identidad') || s === 'ti') return 'TI';
        if (s.includes('pasaporte') || s === 'pp' || s === 'ppn') return 'PP';
        if (s.includes('dni')) return 'DNI';
        if (s.includes('rut')) return 'RUT';
        if (typeof idTypeObj === 'string' && idTypeObj.length <= 10) return idTypeObj;
        if (idTypeObj && idTypeObj.code && String(idTypeObj.code).length <= 10) return String(idTypeObj.code);
        return 'OTRO';
      } catch (_) {
        return 'OTRO';
      }
    };
    
    // Extraer commercial_name con lógica mejorada
    const extractCommercialName = (customer) => {
      // Para empresas: usar commercial_name o company name
      if (customer.person_type === 'Company') {
        if (customer.commercial_name && customer.commercial_name !== 'No aplica' && customer.commercial_name.trim() !== '') {
          return customer.commercial_name.trim();
        }
        
        if (customer.company?.name) {
          return customer.company.name.trim();
        }
        
        // Si es array de nombres (empresas), usar el primer elemento
        if (customer.name && Array.isArray(customer.name) && customer.name.length > 0) {
          return customer.name[0].trim();
        }
      }
      
      // Para personas naturales, retornar null ya que no tienen nombre comercial
      return null;
    };

    // Extraer customer_name
    const extractCustomerName = (customer) => {
      // Prioridad 1: Nombre comercial (IGNORAR "No aplica")
      if (customer.commercial_name && customer.commercial_name !== 'No aplica') {
        return customer.commercial_name;
      }
      
      // Prioridad 2: Para empresas, usar company name
      if (customer.person_type === 'Company' && customer.company?.name) {
        return customer.company.name;
      }
      
      // Prioridad 3: Persona física - construir nombre completo
      if (customer.name && Array.isArray(customer.name) && customer.name.length >= 2) {
        return customer.name.join(' ').trim();
      }
      
      // Prioridad 4: first_name + last_name si existe person
      if (customer.person?.first_name) {
        return `${customer.person.first_name} ${customer.person.last_name || ''}`.trim();
      }
      
      // Fallback
      return customer.identification?.name || 'Cliente SIIGO';
    };

    const extractedData = {
      commercial_name: extractCommercialName(customerData),
      customer_name: extractCustomerName(customerData),
      customer_identification: customerData.identification || null,
      customer_id_type: normalizeIdType(customerData.id_type) || null,
      customer_person_type: customerData.person_type || null,
      customer_email: null,
      customer_phone: customerData.phones?.[0]?.number || customerData.person?.phones?.[0]?.number || customerData.company?.phones?.[0]?.number || null,
      customer_address: customerData.address?.address || customerData.person?.address?.address || customerData.company?.address?.address || null,
      customer_city: customerData.address?.city?.city_name || null,
      customer_department: customerData.address?.city?.state_name || null,
      customer_country: customerData.address?.city?.country_name || 'Colombia'
    };

    // Extraer email de contacts
    if (customerData.contacts && Array.isArray(customerData.contacts) && customerData.contacts.length > 0) {
      extractedData.customer_email = customerData.contacts[0].email || null;
    } else if (customerData.email) {
      extractedData.customer_email = customerData.email;
    }

    // Sanitizar todos los campos de texto
    Object.keys(extractedData).forEach(key => {
      if (typeof extractedData[key] === 'string') {
        extractedData[key] = this.sanitizeText(extractedData[key]);
      }
    });

    console.log(`📋 Datos extraídos para cliente:`, {
      commercial_name: extractedData.commercial_name,
      customer_name: extractedData.customer_name,
      customer_identification: extractedData.customer_identification,
      person_type: extractedData.customer_person_type
    });

    return extractedData;
  }

  // Actualizar pedido con datos del cliente
  async updateOrderWithCustomerData(orderId, customerData) {
    try {
      // Solo actualizar campos que están NULL o vacíos
      await query(`
        UPDATE orders SET
          commercial_name = COALESCE(commercial_name, ?),
          customer_identification = COALESCE(customer_identification, ?),
          customer_id_type = COALESCE(customer_id_type, ?),
          customer_person_type = COALESCE(customer_person_type, ?),
          customer_email = COALESCE(customer_email, ?),
          customer_phone = COALESCE(customer_phone, ?),
          customer_address = COALESCE(customer_address, ?),
          customer_city = COALESCE(customer_city, ?),
          customer_department = COALESCE(customer_department, ?),
          customer_country = COALESCE(customer_country, ?),
          updated_at = NOW()
        WHERE id = ?
      `, [
        customerData.commercial_name,
        customerData.customer_identification,
        customerData.customer_id_type,
        customerData.customer_person_type,
        customerData.customer_email,
        customerData.customer_phone,
        customerData.customer_address,
        customerData.customer_city,
        customerData.customer_department,
        customerData.customer_country,
        orderId
      ]);

      console.log(`✅ Pedido ${orderId} actualizado con datos del cliente`);
      
    } catch (error) {
      console.error(`❌ Error actualizando pedido ${orderId}:`, error.message);
      throw error;
    }
  }

  // Crear o actualizar cliente en tabla customers
  async upsertCustomer(siigoId, customerData) {
    try {
      // Verificar si el cliente ya existe
      const existing = await query(`
        SELECT id FROM customers WHERE siigo_id = ?
      `, [siigoId]);

      if (existing.length > 0) {
        // Actualizar cliente existente
        await query(`
          UPDATE customers SET
            name = COALESCE(name, ?),
            commercial_name = COALESCE(commercial_name, ?),
            identification = COALESCE(identification, ?),
            document_type = COALESCE(document_type, ?),
            phone = COALESCE(phone, ?),
            address = COALESCE(address, ?),
            city = COALESCE(city, ?),
            state = COALESCE(state, ?),
            country = COALESCE(country, ?),
            email = COALESCE(email, ?),
            updated_at = NOW()
          WHERE siigo_id = ?
        `, [
          customerData.customer_name,
          customerData.commercial_name,
          customerData.customer_identification,
          customerData.customer_id_type,
          customerData.customer_phone,
          customerData.customer_address,
          customerData.customer_city,
          customerData.customer_department,
          customerData.customer_country,
          customerData.customer_email,
          siigoId
        ]);
      } else {
        // Crear nuevo cliente
        await query(`
          INSERT INTO customers (
            siigo_id, name, commercial_name, identification, document_type,
            phone, address, city, state, country, email, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [
          siigoId,
          customerData.customer_name,
          customerData.commercial_name,
          customerData.customer_identification,
          customerData.customer_id_type,
          customerData.customer_phone,
          customerData.customer_address,
          customerData.customer_city,
          customerData.customer_department,
          customerData.customer_country,
          customerData.customer_email
        ]);
      }

    } catch (error) {
      console.error(`❌ Error en upsert de cliente ${siigoId}:`, error.message);
      // No lanzar error para no detener el proceso
    }
  }

  // Poblar tabla customers con todos los clientes de SIIGO
  async populateCustomersTable() {
    try {
      console.log('📥 Poblando tabla customers con clientes de SIIGO...');
      
      // Obtener clientes de SIIGO que no están en nuestra BD
      const existingSiigoIds = await query(`
        SELECT DISTINCT siigo_id FROM customers WHERE siigo_id IS NOT NULL
      `);
      const existingIds = new Set(existingSiigoIds.map(row => row.siigo_id));

      // Obtener algunos clientes directamente desde SIIGO (paginación)
      let page = 1;
      let hasMorePages = true;
      let newCustomersCount = 0;

      while (hasMorePages && page <= 5) { // Limitar a 5 páginas para no sobrecargar
        try {
          const siigoCustomers = await this.siigoService.getCustomers(page, 25);
          
          if (!siigoCustomers || siigoCustomers.length === 0) {
            hasMorePages = false;
            break;
          }

          for (const customer of siigoCustomers) {
            if (!existingIds.has(customer.id)) {
              try {
                const customerData = this.extractCompleteCustomerData(customer);
                await this.upsertCustomer(customer.id, customerData);
                newCustomersCount++;
                existingIds.add(customer.id);
              } catch (error) {
                console.error(`Error agregando cliente ${customer.id}:`, error.message);
              }
            }
          }

          // Si obtuvimos menos del pageSize, probablemente no hay más páginas
          if (siigoCustomers.length < 25) {
            hasMorePages = false;
          } else {
            page++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`Error obteniendo página ${page}:`, error.message);
          hasMorePages = false;
        }
      }

      console.log(`✅ ${newCustomersCount} nuevos clientes agregados a la tabla customers`);

    } catch (error) {
      console.error('❌ Error poblando tabla customers:', error.message);
      // No lanzar error para no detener el proceso principal
    }
  }

  // Actualizar un solo cliente específico
  async updateSingleCustomer(siigoCustomerId) {
    try {
      console.log(`🔄 Actualizando cliente específico: ${siigoCustomerId}`);
      
      // Obtener datos del cliente desde SIIGO
      const customerData = await this.siigoService.getCustomer(siigoCustomerId);
      
      if (!customerData) {
        throw new Error('No se pudo obtener datos del cliente desde SIIGO');
      }

      // Extraer datos completos
      const extractedData = this.extractCompleteCustomerData(customerData);

      // Actualizar todos los pedidos de este cliente
      const ordersToUpdate = await query(`
        SELECT id FROM orders WHERE siigo_customer_id = ?
      `, [siigoCustomerId]);

      for (const order of ordersToUpdate) {
        await this.updateOrderWithCustomerData(order.id, extractedData);
      }

      // Actualizar tabla customers
      await this.upsertCustomer(siigoCustomerId, extractedData);

      console.log(`✅ Cliente ${siigoCustomerId} actualizado: ${ordersToUpdate.length} pedidos`);

      return {
        success: true,
        message: `Cliente actualizado exitosamente`,
        ordersUpdated: ordersToUpdate.length
      };

    } catch (error) {
      console.error(`❌ Error actualizando cliente ${siigoCustomerId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new CustomerUpdateService();

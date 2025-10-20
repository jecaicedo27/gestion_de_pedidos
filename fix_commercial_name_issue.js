const { query } = require('./backend/config/database');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// Simulación básica del servicio SIIGO para esta corrección
class SiigoServiceDiagnostic {
  constructor() {
    this.baseURL = process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com';
    this.username = process.env.SIIGO_API_USERNAME;
    this.accessKey = process.env.SIIGO_API_ACCESS_KEY;
    this.token = null;
    this.tokenExpiry = null;
    this.customersCache = new Map();
  }

  async authenticate() {
    try {
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.token;
      }

      console.log('🔐 Autenticando con SIIGO API...');
      
      if (!this.username || !this.accessKey) {
        throw new Error('Credenciales SIIGO no configuradas');
      }

      const response = await axios.post(`${this.baseURL}/auth`, {
        username: this.username,
        access_key: this.accessKey
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      this.token = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      console.log('✅ Autenticación exitosa');
      return this.token;
      
    } catch (error) {
      console.error('❌ Error en autenticación SIIGO:', error.message);
      throw new Error('No se pudo autenticar con SIIGO API');
    }
  }

  async getHeaders() {
    const token = await this.authenticate();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Partner-Id': 'siigo'
    };
  }

  async getCustomer(customerId) {
    try {
      // Verificar caché primero
      const cacheKey = customerId;
      const cached = this.customersCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 minutos
        console.log(`✅ Cliente obtenido desde caché: ${customerId}`);
        return cached.data;
      }

      const headers = await this.getHeaders();
      
      console.log(`👤 Obteniendo cliente SIIGO: ${customerId}`);
      
      const response = await axios.get(`${this.baseURL}/v1/customers/${customerId}`, {
        headers,
        timeout: 20000
      });

      console.log(`✅ Cliente obtenido: ${customerId}`);
      const customerData = response.data;

      // Guardar en caché
      this.customersCache.set(cacheKey, {
        data: customerData,
        timestamp: Date.now()
      });
      
      console.log(`✅ Cliente cacheado: ${customerId}`);
      return customerData;

    } catch (error) {
      console.error(`❌ Error obteniendo cliente ${customerId}:`, error.message);
      throw error;
    }
  }

  // Función para extraer el nombre comercial específicamente
  extractCommercialName(customerInfo) {
    console.log('🔍 Extrayendo commercial_name...');
    console.log('📊 customerInfo completo:', JSON.stringify(customerInfo, null, 2));
    
    // Prioridad 1: commercial_name del customerInfo (si no es "No aplica")
    if (customerInfo.commercial_name && customerInfo.commercial_name !== 'No aplica') {
      console.log(`✅ Encontrado commercial_name: ${customerInfo.commercial_name}`);
      return customerInfo.commercial_name;
    }
    
    // Prioridad 2: company.name si es una empresa
    if (customerInfo.company?.name) {
      console.log(`✅ Encontrado company.name: ${customerInfo.company.name}`);
      return customerInfo.company.name;
    }
    
    // Prioridad 3: identification.name (razón social)
    if (customerInfo.identification?.name) {
      console.log(`✅ Encontrado identification.name: ${customerInfo.identification.name}`);
      return customerInfo.identification.name;
    }
    
    console.log('❌ No se encontró commercial_name válido');
    return null;
  }

  // Función para extraer el nombre completo/personal
  extractPersonName(customerInfo) {
    console.log('🔍 Extrayendo nombre de persona...');
    
    // Prioridad 1: Persona física - construir nombre completo
    if (customerInfo.name && Array.isArray(customerInfo.name) && customerInfo.name.length >= 2) {
      const fullName = customerInfo.name.join(' ').trim();
      console.log(`✅ Encontrado name array: ${fullName}`);
      return fullName;
    }
    
    // Prioridad 2: first_name + last_name si existe person
    if (customerInfo.person?.first_name) {
      const fullName = `${customerInfo.person.first_name} ${customerInfo.person.last_name || ''}`.trim();
      console.log(`✅ Encontrado person.first_name/last_name: ${fullName}`);
      return fullName;
    }
    
    console.log('❌ No se encontró nombre de persona válido');
    return null;
  }
}

async function diagnoseCommercialNameIssue() {
  try {
    console.log('🔍 DIAGNÓSTICO DEL PROBLEMA DE COMMERCIAL_NAME');
    console.log('=' .repeat(60));
    
    // 1. Verificar estructura de la tabla
    console.log('\n1️⃣ Verificando estructura de la tabla orders...');
    
    const tableStructure = await query(`
      DESCRIBE orders
    `);
    
    const commercialNameColumn = tableStructure.find(col => 
      col.Field === 'commercial_name' || col.Field === 'customer_commercial_name'
    );
    
    if (commercialNameColumn) {
      console.log(`✅ Columna encontrada: ${commercialNameColumn.Field} (${commercialNameColumn.Type})`);
    } else {
      console.log('❌ No se encontró columna commercial_name en la tabla orders');
      
      // Agregar columna si no existe
      console.log('➕ Agregando columna commercial_name...');
      await query(`
        ALTER TABLE orders 
        ADD COLUMN commercial_name VARCHAR(500) NULL AFTER customer_name
      `);
      console.log('✅ Columna commercial_name agregada');
    }
    
    // 2. Verificar registros con commercial_name NULL
    console.log('\n2️⃣ Verificando registros con commercial_name NULL...');
    
    const ordersWithNullCommercialName = await query(`
      SELECT 
        id, order_number, customer_name, commercial_name, siigo_customer_id 
      FROM orders 
      WHERE commercial_name IS NULL 
        AND siigo_customer_id IS NOT NULL 
        AND siigo_customer_id != ''
      ORDER BY id DESC 
      LIMIT 20
    `);
    
    console.log(`📊 Encontrados ${ordersWithNullCommercialName.length} pedidos con commercial_name NULL`);
    
    if (ordersWithNullCommercialName.length > 0) {
      console.log('\n🔧 Corrigiendo commercial_name para estos pedidos...');
      
      const siigoService = new SiigoServiceDiagnostic();
      let corrected = 0;
      let failed = 0;
      
      for (const order of ordersWithNullCommercialName) {
        try {
          console.log(`\n🔄 Procesando pedido ${order.order_number} (ID: ${order.id})`);
          console.log(`👤 SIIGO Customer ID: ${order.siigo_customer_id}`);
          
          // Obtener información del cliente desde SIIGO
          const customerInfo = await siigoService.getCustomer(order.siigo_customer_id);
          
          // Extraer commercial_name y nombre personal
          const commercialName = siigoService.extractCommercialName(customerInfo);
          const personName = siigoService.extractPersonName(customerInfo);
          
          console.log(`📊 Commercial Name: ${commercialName || 'NULL'}`);
          console.log(`👤 Person Name: ${personName || 'NULL'}`);
          
          // Actualizar base de datos
          if (commercialName) {
            await query(`
              UPDATE orders 
              SET commercial_name = ?
              WHERE id = ?
            `, [commercialName, order.id]);
            console.log(`✅ Commercial name actualizado: ${commercialName}`);
            corrected++;
          } else {
            console.log(`⚠️ No se pudo extraer commercial_name para pedido ${order.order_number}`);
            failed++;
          }
          
          // Pequeña pausa para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Error procesando pedido ${order.order_number}:`, error.message);
          failed++;
        }
      }
      
      console.log(`\n📊 RESUMEN DE CORRECCIÓN:`);
      console.log(`✅ Corregidos: ${corrected}`);
      console.log(`❌ Fallidos: ${failed}`);
    }
    
    // 3. Verificar el estado después de la corrección
    console.log('\n3️⃣ Verificando estado después de la corrección...');
    
    const finalStats = await query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(commercial_name) as with_commercial_name,
        COUNT(*) - COUNT(commercial_name) as missing_commercial_name
      FROM orders 
      WHERE siigo_customer_id IS NOT NULL
    `);
    
    const stats = finalStats[0];
    console.log(`📊 ESTADÍSTICAS FINALES:`);
    console.log(`📦 Total pedidos con SIIGO customer ID: ${stats.total_orders}`);
    console.log(`✅ Con commercial_name: ${stats.with_commercial_name}`);
    console.log(`❌ Sin commercial_name: ${stats.missing_commercial_name}`);
    
    const coverage = ((stats.with_commercial_name / stats.total_orders) * 100).toFixed(1);
    console.log(`📈 Cobertura: ${coverage}%`);
    
    console.log('\n✅ DIAGNÓSTICO COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    throw error;
  }
}

// Función para mostrar algunos ejemplos de clientes con datos faltantes
async function showExampleMissingData() {
  try {
    console.log('\n📋 EJEMPLOS DE REGISTROS CON DATOS FALTANTES:');
    console.log('=' .repeat(50));
    
    const examples = await query(`
      SELECT 
        id, order_number, customer_name, commercial_name, 
        customer_phone, customer_address, siigo_customer_id
      FROM orders 
      WHERE (
        commercial_name IS NULL OR
        customer_phone IS NULL OR 
        customer_phone = 'Sin teléfono' OR
        customer_address IS NULL OR
        customer_address = 'Sin dirección'
      )
      AND siigo_customer_id IS NOT NULL
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    examples.forEach((order, index) => {
      console.log(`\n${index + 1}. Pedido: ${order.order_number} (ID: ${order.id})`);
      console.log(`   👤 Customer Name: ${order.customer_name || 'NULL'}`);
      console.log(`   🏢 Commercial Name: ${order.commercial_name || 'NULL'}`);
      console.log(`   📞 Phone: ${order.customer_phone || 'NULL'}`);
      console.log(`   📍 Address: ${order.customer_address || 'NULL'}`);
      console.log(`   🔗 SIIGO ID: ${order.siigo_customer_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error mostrando ejemplos:', error);
  }
}

async function main() {
  try {
    console.log('🚀 INICIANDO CORRECCIÓN DE COMMERCIAL_NAME');
    console.log('Fecha y hora:', new Date().toLocaleString());
    console.log('\n');
    
    await diagnoseCommercialNameIssue();
    await showExampleMissingData();
    
    console.log('\n🎉 PROCESO COMPLETADO EXITOSAMENTE');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 ERROR FATAL:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  diagnoseCommercialNameIssue,
  showExampleMissingData 
};

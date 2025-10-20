const axios = require('axios');

/**
 * Script para encontrar un cliente válido para usar en las pruebas
 */

async function findValidCustomer() {
  console.log('🔍 BUSCANDO CLIENTE VÁLIDO PARA PRUEBAS');
  console.log('=====================================\n');

  try {
    // 1. Hacer login para obtener token válido
    console.log('📝 PASO 1: Autenticación del usuario');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login falló');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso, token obtenido');

    // 2. Buscar clientes existentes
    console.log('\n🔍 PASO 2: Buscando clientes existentes');
    
    const searchResponse = await axios.get(
      'http://localhost:3001/api/quotations/customers/search?q=mostrador',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📋 Response status:', searchResponse.status);
    console.log('📋 Clientes encontrados:', searchResponse.data.customers?.length || 0);

    if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
      console.log('\n✅ CLIENTES VÁLIDOS ENCONTRADOS:');
      console.log('==============================');
      
      searchResponse.data.customers.slice(0, 5).forEach((customer, index) => {
        console.log(`\nCliente ${index + 1}:`);
        console.log(`  ID: ${customer.id}`);
        console.log(`  Nombre: ${customer.name}`);
        console.log(`  Identificación: ${customer.identification}`);
        console.log(`  SIIGO ID: ${customer.siigo_id || 'No disponible'}`);
        console.log(`  Email: ${customer.email || 'No disponible'}`);
      });

      // Recomendar el primer cliente válido
      const validCustomer = searchResponse.data.customers[0];
      console.log('\n🎯 CLIENTE RECOMENDADO PARA PRUEBAS:');
      console.log('===================================');
      console.log(`ID: ${validCustomer.id}`);
      console.log(`Nombre: ${validCustomer.name}`);
      console.log(`Identificación: ${validCustomer.identification}`);
      console.log(`SIIGO ID: ${validCustomer.siigo_id}`);
      
      if (!validCustomer.siigo_id) {
        console.log('\n⚠️ ADVERTENCIA: Este cliente no tiene SIIGO ID.');
        console.log('Es posible que la creación de factura falle.');
        console.log('Considere usar un cliente que tenga SIIGO ID válido.');
      }

      return validCustomer.id;
    } else {
      console.log('\n❌ No se encontraron clientes');
      console.log('Intente con otro término de búsqueda o sincronice clientes desde SIIGO');
      return null;
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return null;
  }
}

// Ejecutar la búsqueda
if (require.main === module) {
  findValidCustomer().then(customerId => {
    if (customerId) {
      console.log(`\n✅ Usar customer_id: "${customerId}" en las pruebas`);
    }
  }).catch(console.error);
}

module.exports = { findValidCustomer };

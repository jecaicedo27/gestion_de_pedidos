const axios = require('axios');
const mysql = require('mysql2/promise');

const BASE_URL = 'http://localhost:3001';

// Configuración de base de datos
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function testCustomerUpdateSystem() {
  console.log('🧪 TESTING CUSTOMER UPDATE SYSTEM');
  console.log('=====================================');
  
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database');
    
    // 1. Verificar estado inicial
    console.log('\n1. 📊 Checking initial customer data status...');
    const [orderStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN commercial_name IS NULL THEN 1 END) as missing_commercial_name,
        COUNT(CASE WHEN commercial_name IS NOT NULL AND commercial_name != '' THEN 1 END) as has_commercial_name
      FROM orders 
      WHERE siigo_customer_id IS NOT NULL
    `);
    
    console.log(`   📋 Total SIIGO orders: ${orderStats[0].total_orders}`);
    console.log(`   ❌ Missing commercial_name: ${orderStats[0].missing_commercial_name}`);
    console.log(`   ✅ Has commercial_name: ${orderStats[0].has_commercial_name}`);
    
    if (orderStats[0].missing_commercial_name === 0) {
      console.log('✅ All orders already have commercial_name populated!');
      return;
    }
    
    // 2. Autenticar para obtener token
    console.log('\n2. 🔐 Authenticating...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('   📋 Login response data:', JSON.stringify(loginResponse.data, null, 2));
    const token = loginResponse.data.data?.token || loginResponse.data.token;
    
    if (!token) {
      throw new Error('No token received from login response');
    }
    
    console.log('   ✅ Authentication successful');
    console.log('   🔑 Token extracted:', token.substring(0, 20) + '...');
    
    // 3. Probar endpoint de estadísticas
    console.log('\n3. 📈 Testing customer stats endpoint...');
    const statsResponse = await axios.get(`${BASE_URL}/api/customers/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('   📊 Stats response:', JSON.stringify(statsResponse.data, null, 2));
    
    // 4. Probar actualización masiva (primeros 5 clientes como test)
    console.log('\n4. 🔄 Testing customer mass update (limited test)...');
    
    // Obtener algunos customer IDs para test
    const [testCustomers] = await connection.execute(`
      SELECT DISTINCT siigo_customer_id 
      FROM orders 
      WHERE siigo_customer_id IS NOT NULL 
        AND (commercial_name IS NULL OR commercial_name = '')
      LIMIT 3
    `);
    
    if (testCustomers.length === 0) {
      console.log('   ℹ️  No customers need updates');
      return;
    }
    
    console.log(`   🎯 Testing with ${testCustomers.length} customers...`);
    
    // Hacer la petición de actualización
    const updateResponse = await axios.post(
      `${BASE_URL}/api/customers/update-all-from-siigo`,
      { limit: 3 }, // Limitar para test
      { 
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000 // 30 segundos timeout
      }
    );
    
    console.log('   📝 Update response:', JSON.stringify(updateResponse.data, null, 2));
    
    // 5. Verificar resultados
    console.log('\n5. ✅ Verifying results...');
    const [finalStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN commercial_name IS NULL THEN 1 END) as missing_commercial_name,
        COUNT(CASE WHEN commercial_name IS NOT NULL AND commercial_name != '' THEN 1 END) as has_commercial_name
      FROM orders 
      WHERE siigo_customer_id IS NOT NULL
    `);
    
    console.log(`   📋 Final total SIIGO orders: ${finalStats[0].total_orders}`);
    console.log(`   ❌ Final missing commercial_name: ${finalStats[0].missing_commercial_name}`);
    console.log(`   ✅ Final has commercial_name: ${finalStats[0].has_commercial_name}`);
    
    // Mostrar algunos ejemplos de datos actualizados
    const [examples] = await connection.execute(`
      SELECT customer_name, commercial_name, siigo_customer_id
      FROM orders 
      WHERE siigo_customer_id IN (${testCustomers.map(() => '?').join(',')})
        AND commercial_name IS NOT NULL
      LIMIT 3
    `, testCustomers.map(c => c.siigo_customer_id));
    
    if (examples.length > 0) {
      console.log('\n   📋 Examples of updated data:');
      examples.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.customer_name} → Commercial: "${row.commercial_name}"`);
      });
    }
    
    console.log('\n🎉 CUSTOMER UPDATE SYSTEM TEST COMPLETED!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   📄 Response data:', error.response.data);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar el test
testCustomerUpdateSystem().catch(console.error);

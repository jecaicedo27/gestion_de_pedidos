const axios = require('axios');

const baseURL = 'http://localhost:3001';

async function testInventoryAPI() {
  try {
    console.log('🔥 Restarting backend y probando API de inventario...\n');
    
    // Esperar un momento para que el backend inicie
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Health check del servidor
    console.log('1️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get(`${baseURL}/api/health`);
      console.log('✅ Server is running:', healthResponse.data.message);
    } catch (error) {
      console.log('❌ Server not responding. Waiting 3 more seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Test 2: Login para obtener token
    console.log('\n2️⃣ Getting authentication token...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token obtained');
    
    // Test 3: Probar endpoint de inventario agrupado
    console.log('\n3️⃣ Testing inventory grouped endpoint...');
    const inventoryResponse = await axios.get(`${baseURL}/api/inventory/grouped`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (inventoryResponse.data.success) {
      console.log('✅ Inventory API working!');
      console.log(`📊 Products count: ${inventoryResponse.data.data.length}`);
      
      // Mostrar algunos ejemplos de productos
      const products = inventoryResponse.data.data;
      if (products.length > 0) {
        console.log('\n📦 Sample products:');
        products.slice(0, 5).forEach((product, index) => {
          console.log(`${index + 1}. ${product.product_name} - Stock: ${product.available_quantity || 0}`);
        });
        
        // Verificar si tenemos productos con stock
        const productsWithStock = products.filter(p => (p.available_quantity || 0) > 0);
        console.log(`\n🟢 Products with stock: ${productsWithStock.length}`);
        
        if (productsWithStock.length > 0) {
          console.log('✅ ¡PROBLEMA RESUELTO! La API de inventario ahora devuelve datos reales con stock');
          console.log('🎉 El frontend ya debería mostrar las cantidades correctas en lugar de ceros');
        } else {
          console.log('⚠️  API funciona pero todos los productos muestran stock 0');
        }
      } else {
        console.log('⚠️  API funciona pero no hay productos en la base de datos');
      }
    } else {
      console.log('❌ Inventory API failed:', inventoryResponse.data.message);
    }
    
    // Test 4: Probar endpoint de búsqueda
    console.log('\n4️⃣ Testing inventory search endpoint...');
    const searchResponse = await axios.get(`${baseURL}/api/inventory/search?q=BLUEBERRY`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (searchResponse.data.success) {
      console.log('✅ Inventory search working!');
      console.log(`🔍 Search results: ${searchResponse.data.data.length} products found`);
    } else {
      console.log('❌ Inventory search failed:', searchResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing inventory API:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Server is not running. Starting backend first...');
    } else if (error.response?.status === 404) {
      console.log('\n💡 Route not found. The inventory routes may still not be registered properly.');
    }
  }
}

// Ejecutar test
testInventoryAPI();

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

// Credenciales de prueba
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

async function testInventorySyncAfterFix() {
  console.log('🧪 Probando sincronización de inventario después del arreglo...\n');

  try {
    // 1. Login
    console.log('1️⃣ Realizando login...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error('Login falló: ' + loginData.message);
    }

    const token = loginData.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Ejecutar sincronización
    console.log('2️⃣ Ejecutando sincronización de inventario desde SIIGO...');
    const syncResponse = await fetch(`${API_BASE}/products/sync-inventory`, {
      method: 'POST',
      headers: authHeaders
    });

    const syncData = await syncResponse.json();
    
    if (syncData.success) {
      console.log('✅ Sincronización ejecutada exitosamente!');
      console.log(`📊 Productos procesados: ${syncData.processed_products || 'N/A'}`);
      console.log(`🔄 Productos actualizados: ${syncData.updated_products || 'N/A'}`);
      console.log(`⏰ Tiempo de procesamiento: ${syncData.processing_time || 'N/A'}`);
    } else {
      console.log('❌ Error en sincronización:', syncData.message);
      if (syncData.error) {
        console.log('   Detalles:', syncData.error);
      }
    }

    // 3. Verificar productos después de sincronización
    console.log('\n3️⃣ Verificando inventario actualizado...');
    const productsResponse = await fetch(`${API_BASE}/products?category=LIQUIPOPS&pageSize=10`, {
      headers: authHeaders
    });

    const productsData = await productsResponse.json();
    
    if (productsData.success) {
      console.log('📦 Productos LIQUIPOPS con stock actualizado:');
      let hasStock = false;
      let hasZeroStock = false;

      productsData.data.forEach(product => {
        const stock = product.available_quantity || 0;
        const status = stock > 0 ? '✅' : '❌';
        console.log(`   ${status} ${product.product_name} - Stock: ${stock}`);
        
        if (stock > 0) hasStock = true;
        if (stock === 0) hasZeroStock = true;
      });

      console.log('\n📊 RESULTADO DE LA SINCRONIZACIÓN:');
      if (hasStock && !hasZeroStock) {
        console.log('🎉 EXCELENTE: Todos los productos tienen stock > 0');
      } else if (hasStock && hasZeroStock) {
        console.log('✅ BUENO: Algunos productos tienen stock real, otros están en 0');
        console.log('   (Esto es normal si algunos productos no están en SIIGO o no tienen stock)');
      } else if (!hasStock) {
        console.log('❌ PROBLEMA: Todos los productos siguen en stock 0');
        console.log('   • Verificar configuración SIIGO');
        console.log('   • Verificar que los productos existan en SIIGO');
        console.log('   • Verificar conectividad con la API de SIIGO');
      }
    } else {
      console.log('❌ Error obteniendo productos:', productsData.message);
    }

    // 4. Probar página de inventario + facturación
    console.log('\n4️⃣ Verificando página de inventario + facturación...');
    console.log('🌐 La página debería mostrar ahora:');
    console.log('   • Stock real desde SIIGO en lugar de ceros');
    console.log('   • Botones de color verde/amarillo/rojo según stock');
    console.log('   • Capacidad de sincronizar con botón "Sync SIIGO"');
    console.log('   • Facturación directa funcional');

    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('   1. Ir a la página "Inventario + Facturación"');
    console.log('   2. Hacer click en "Sync SIIGO" si es necesario');
    console.log('   3. Verificar que se muestren números reales en lugar de ceros');
    console.log('   4. Probar agregar productos al carrito y facturar');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.log('\n🔧 Verifica:');
    console.log('   • Que el backend esté corriendo en puerto 3001');
    console.log('   • Que la configuración SIIGO esté correcta en .env');
    console.log('   • Que las credenciales de SIIGO sean válidas');
  }
}

// Ejecutar prueba
testInventorySyncAfterFix();

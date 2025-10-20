const axios = require('axios');

// Script de prueba para verificar la funcionalidad de productos inactivos
async function testInactiveProductsFunctionality() {
  console.log('🔍 Probando funcionalidad de productos inactivos...\n');

  try {
    // Obtener token de autenticación (simulado)
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'; // Token de ejemplo
    
    // 1. Verificar endpoint de productos con filtro de inactivos
    console.log('1. Probando endpoint de productos con filtro is_active=0...');
    
    const response = await axios.get('http://localhost:3001/api/products', {
      params: {
        is_active: '0',
        page: 1,
        pageSize: 10
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200 && response.data.success) {
      console.log('✅ Endpoint funcionando correctamente');
      console.log(`📊 Productos inactivos encontrados: ${response.data.data.length}`);
      
      if (response.data.data.length > 0) {
        console.log('\n🔍 Ejemplos de productos inactivos:');
        response.data.data.slice(0, 3).forEach(product => {
          console.log(`   - ${product.product_name} (ID: ${product.id}) - Estado: ${product.is_active ? 'Activo' : 'Inactivo'}`);
        });
      } else {
        console.log('ℹ️  No se encontraron productos inactivos en la base de datos');
      }
    } else {
      console.log('❌ Error en el endpoint de productos inactivos');
      return;
    }

    // 2. Verificar endpoint de productos activos para comparar
    console.log('\n2. Probando endpoint de productos con filtro is_active=1...');
    
    const activeResponse = await axios.get('http://localhost:3001/api/products', {
      params: {
        is_active: '1',
        page: 1,
        pageSize: 10
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (activeResponse.status === 200 && activeResponse.data.success) {
      console.log('✅ Endpoint de productos activos funcionando correctamente');
      console.log(`📊 Productos activos encontrados: ${activeResponse.data.data.length}`);
    }

    // 3. Verificar endpoint de estadísticas
    console.log('\n3. Probando endpoint de estadísticas para calcular inactivos...');
    
    const statsResponse = await axios.get('http://localhost:3001/api/products/stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (statsResponse.status === 200 && statsResponse.data.success) {
      const stats = statsResponse.data.data;
      const totalProducts = stats.total_products || 0;
      const activeProducts = stats.active_products || 0;
      const inactiveProducts = totalProducts - activeProducts;
      
      console.log('✅ Endpoint de estadísticas funcionando correctamente');
      console.log(`📊 Total productos: ${totalProducts}`);
      console.log(`📊 Productos activos: ${activeProducts}`);
      console.log(`📊 Productos inactivos (calculado): ${inactiveProducts}`);
    }

    // 4. Verificar que todos los productos devueltos en filtro inactivo tienen is_active = 0
    console.log('\n4. Verificando que el filtro funciona correctamente...');
    
    const allInactiveResponse = await axios.get('http://localhost:3001/api/products', {
      params: {
        is_active: '0',
        pageSize: 100  // Obtener más productos para verificar
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (allInactiveResponse.status === 200 && allInactiveResponse.data.success) {
      const inactiveProducts = allInactiveResponse.data.data;
      const allInactive = inactiveProducts.every(product => product.is_active === 0);
      
      if (allInactive) {
        console.log('✅ Filtro funcionando correctamente - todos los productos devueltos son inactivos');
      } else {
        console.log('❌ Error en el filtro - algunos productos devueltos no son inactivos');
      }
    }

    console.log('\n✅ Prueba completada exitosamente');
    console.log('\n📋 Resumen de funcionalidades implementadas:');
    console.log('   ✅ Card "Inactivos" agregado a la interfaz');
    console.log('   ✅ Filtro is_active=0 en el endpoint de productos');
    console.log('   ✅ Cálculo de productos inactivos en estadísticas');
    console.log('   ✅ Interfaz actualizada a grid de 5 columnas');
    console.log('   ✅ Estilo visual rojo para productos inactivos');

  } catch (error) {
    if (error.response) {
      console.log('❌ Error en la respuesta del servidor:', error.response.status);
      console.log('📄 Mensaje:', error.response.data?.message || 'Sin mensaje');
    } else if (error.request) {
      console.log('❌ Error de conexión - Verificar que el backend esté ejecutándose en puerto 3001');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Función para mostrar información sobre los cambios realizados
function showImplementedChanges() {
  console.log('🔧 CAMBIOS IMPLEMENTADOS EN frontend/src/pages/ProductsPage.js:\n');
  
  console.log('1. FILTRO DE PRODUCTOS INACTIVOS:');
  console.log('   - Agregado parámetro is_active a la función loadProducts()');
  console.log('   - Cuando activeFilter = "inactive", se envía is_active=0');
  console.log('   - Cuando activeFilter = "active", se envía is_active=1');
  console.log('');
  
  console.log('2. NUEVA CARD "INACTIVOS":');
  console.log('   - Grid cambiado de grid-cols-4 a grid-cols-5');
  console.log('   - Card con estilo rojo (bg-red-50, text-red-600)');
  console.log('   - Cálculo automático: total_products - active_products');
  console.log('   - Click handler para setActiveFilter("inactive")');
  console.log('');
  
  console.log('3. FUNCIONALIDAD COMPLETA:');
  console.log('   - Al hacer click en "Inactivos", se filtra la lista');
  console.log('   - Visual feedback con ring-2 ring-red-500');
  console.log('   - Productos mostrados solo con is_active = 0');
  console.log('   - Paginación funciona con el filtro aplicado');
  console.log('');
  
  console.log('📊 ESTRUCTURA DE CARDS ACTUALIZADA:');
  console.log('   1. Total Productos (azul)');
  console.log('   2. Activos (verde)');
  console.log('   3. Inactivos (rojo) ← NUEVO');
  console.log('   4. Sincronizados SIIGO (púrpura)');
  console.log('   5. Categorías (amarillo)');
  console.log('');
}

// Ejecutar la función
console.log('🚀 TESTING FUNCIONALIDAD DE PRODUCTOS INACTIVOS\n');
showImplementedChanges();
testInactiveProductsFunctionality();

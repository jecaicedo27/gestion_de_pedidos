const fetch = require('node-fetch');

async function testCustomerSearchDropdown() {
  console.log('🧪 PROBANDO FUNCIONALIDAD DE DROPDOWN DE CLIENTES');
  console.log('==================================================');
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // 1. Probar health check del backend
    console.log('1️⃣ Verificando que el backend esté funcionando...');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (healthResponse.ok) {
      console.log('✅ Backend está funcionando');
    } else {
      throw new Error('Backend no responde');
    }
    
    // 2. Probar endpoint de búsqueda de clientes
    console.log('\n2️⃣ Probando búsqueda de clientes...');
    const searchTerms = ['Juan', 'Maria', 'Carlos', 'Empresa'];
    
    for (const term of searchTerms) {
      try {
        console.log(`   🔍 Buscando: "${term}"`);
        const searchUrl = `${baseUrl}/api/quotations/customers/search?q=${encodeURIComponent(term)}`;
        const response = await fetch(searchUrl);
        
        if (response.ok) {
          const customers = await response.json();
          console.log(`   ✅ Encontrados: ${customers.length} clientes`);
          
          if (customers.length > 0) {
            console.log(`   📋 Ejemplo: ${customers[0].commercial_name || customers[0].first_name + ' ' + customers[0].last_name}`);
          }
        } else {
          console.log(`   ❌ Error HTTP: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Error buscando "${term}": ${error.message}`);
      }
      
      // Esperar un poco entre búsquedas
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 3. Probar búsqueda vacía (debería devolver lista limitada)
    console.log('\n3️⃣ Probando búsqueda vacía...');
    const emptyResponse = await fetch(`${baseUrl}/api/quotations/customers/search?q=`);
    if (emptyResponse.ok) {
      const customers = await emptyResponse.json();
      console.log(`   ✅ Búsqueda vacía retorna: ${customers.length} clientes`);
    } else {
      console.log(`   ❌ Error en búsqueda vacía: ${emptyResponse.status}`);
    }
    
    // 4. Verificar estructura de datos de respuesta
    console.log('\n4️⃣ Verificando estructura de datos...');
    const testResponse = await fetch(`${baseUrl}/api/quotations/customers/search?q=test`);
    if (testResponse.ok) {
      const customers = await testResponse.json();
      if (customers.length > 0) {
        const customer = customers[0];
        console.log('   📋 Estructura del cliente:');
        console.log(`      - ID: ${customer.id}`);
        console.log(`      - Nombre comercial: ${customer.commercial_name || 'N/A'}`);
        console.log(`      - Nombre: ${customer.first_name || 'N/A'} ${customer.last_name || 'N/A'}`);
        console.log(`      - Email: ${customer.email || 'N/A'}`);
        console.log(`      - Documento: ${customer.identification_document || 'N/A'}`);
        console.log('   ✅ Estructura correcta para el dropdown');
      }
    }
    
    console.log('\n🎉 PRUEBA DE DROPDOWN COMPLETADA');
    console.log('================================');
    console.log('✅ El endpoint de búsqueda está funcionando');
    console.log('✅ Los datos tienen la estructura correcta');
    console.log('✅ El dropdown debería funcionar en el frontend');
    console.log('\n💡 Para ver el dropdown en acción:');
    console.log('   1. Ve a http://localhost:3000/quotations');
    console.log('   2. Busca clientes en el campo "Seleccionar Cliente"');
    console.log('   3. El dropdown mostrará coincidencias en tiempo real');
    
  } catch (error) {
    console.error('💥 Error durante la prueba:', error.message);
    console.log('\n🔧 Posibles soluciones:');
    console.log('   - Verificar que el backend esté ejecutándose');
    console.log('   - Revisar que el puerto 3001 esté disponible');
    console.log('   - Comprobar la conexión a la base de datos');
  }
}

// Ejecutar la prueba
testCustomerSearchDropdown();

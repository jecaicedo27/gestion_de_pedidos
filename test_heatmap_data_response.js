const axios = require('axios');

async function testHeatmapEndpoint() {
  try {
    console.log('🧪 Probando endpoint del mapa de calor...\n');

    // Primero hacer login para obtener token
    console.log('🔐 Obteniendo token de autenticación...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      throw new Error('Error en login: ' + loginResponse.data.message);
    }

    const token = loginResponse.data.token;
    console.log('✅ Token obtenido exitosamente');

    // Probar endpoint del heatmap
    console.log('\n🗺️ Consultando datos del mapa de calor...');
    const heatmapResponse = await axios.get('http://localhost:3001/api/heatmap/colombia-sales', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('\n📊 Respuesta del endpoint:');
    console.log('Success:', heatmapResponse.data.success);
    
    if (heatmapResponse.data.success) {
      const data = heatmapResponse.data;
      
      console.log('\n📈 Resumen de datos:');
      console.log('- Total ciudades:', data.cities?.length || 0);
      console.log('- Pedidos totales:', data.summary?.totalOrders || 0);
      console.log('- Valor total:', data.summary?.totalValue || 0);
      
      console.log('\n🏙️ Primeras 5 ciudades:');
      if (data.cities && data.cities.length > 0) {
        data.cities.slice(0, 5).forEach((city, index) => {
          console.log(`${index + 1}. ${city.customer_city}`);
          console.log(`   - Pedidos: ${city.order_count}`);
          console.log(`   - Valor: ${city.total_value}`);
          console.log(`   - Categoría: ${city.performance_category || 'NO DEFINIDA ❌'}`);
          console.log('');
        });
      }

      console.log('\n🎯 Categorías por rendimiento:');
      if (data.categorizedCities) {
        console.log('- Alto rendimiento:', data.categorizedCities.high?.length || 0, 'ciudades');
        console.log('- Rendimiento medio:', data.categorizedCities.medium?.length || 0, 'ciudades');
        console.log('- Necesita atención:', data.categorizedCities.low?.length || 0, 'ciudades');

        // Mostrar ejemplos de cada categoría
        console.log('\n🔥 Ejemplos alto rendimiento:');
        if (data.categorizedCities.high && data.categorizedCities.high.length > 0) {
          data.categorizedCities.high.slice(0, 3).forEach(city => {
            console.log(`   - ${city.customer_city}: ${city.order_count} pedidos`);
          });
        } else {
          console.log('   ❌ No hay ciudades de alto rendimiento');
        }

        console.log('\n⚡ Ejemplos rendimiento medio:');
        if (data.categorizedCities.medium && data.categorizedCities.medium.length > 0) {
          data.categorizedCities.medium.slice(0, 3).forEach(city => {
            console.log(`   - ${city.customer_city}: ${city.order_count} pedidos`);
          });
        } else {
          console.log('   ❌ No hay ciudades de rendimiento medio');
        }

        console.log('\n👁️ Ejemplos necesita atención:');
        if (data.categorizedCities.low && data.categorizedCities.low.length > 0) {
          data.categorizedCities.low.slice(0, 3).forEach(city => {
            console.log(`   - ${city.customer_city}: ${city.order_count} pedidos`);
          });
        } else {
          console.log('   ❌ No hay ciudades que necesiten atención');
        }
      }

      // Verificar si hay coordenadas
      console.log('\n📍 Verificación de coordenadas:');
      const citiesWithCoords = data.cities?.filter(city => city.coordinates) || [];
      const citiesWithoutCoords = data.cities?.filter(city => !city.coordinates) || [];
      
      console.log(`- Ciudades con coordenadas: ${citiesWithCoords.length}`);
      console.log(`- Ciudades sin coordenadas: ${citiesWithoutCoords.length}`);
      
      if (citiesWithoutCoords.length > 0) {
        console.log('\n❌ Ciudades sin coordenadas:');
        citiesWithoutCoords.forEach(city => {
          console.log(`   - ${city.customer_city}`);
        });
      }

    } else {
      console.log('❌ Error en respuesta:', heatmapResponse.data.message);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    if (error.response?.data) {
      console.error('Detalles del error:', error.response.data);
    }
  }
}

testHeatmapEndpoint();

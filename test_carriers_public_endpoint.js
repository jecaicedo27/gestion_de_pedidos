const axios = require('axios');

async function testPublicCarriersEndpoint() {
  try {
    console.log('🔍 PROBANDO ENDPOINT PÚBLICO DE TRANSPORTADORAS');
    console.log('==============================================\n');

    // Probar endpoint SIN autenticación
    console.log('🚛 Probando endpoint GET /api/logistics/carriers (SIN autenticación)...');
    const carriersResponse = await axios.get('http://localhost:3001/api/logistics/carriers');

    console.log('✅ Respuesta del endpoint exitosa:');
    console.log('Status:', carriersResponse.status);
    console.log('Data structure:', JSON.stringify(carriersResponse.data, null, 2));
    
    if (carriersResponse.data && carriersResponse.data.data) {
      console.log(`\n📊 Total transportadoras: ${carriersResponse.data.data.length}`);
      
      console.log('\n📋 LISTA DE TRANSPORTADORAS:');
      carriersResponse.data.data.forEach((carrier, idx) => {
        console.log(`${idx + 1}. ${carrier.name} (ID: ${carrier.id})`);
      });
      
      // Buscar específicamente Camión Externo
      const camionExterno = carriersResponse.data.data.find(c => c.name === 'Camión Externo');
      if (camionExterno) {
        console.log('\n✅ "Camión Externo" SÍ está en la respuesta del API');
        console.log(`   ID: ${camionExterno.id}`);
        console.log(`   Código: ${camionExterno.code}`);
        console.log(`   Teléfono: ${camionExterno.contact_phone || 'No especificado'}`);
        console.log(`   Email: ${camionExterno.contact_email || 'No especificado'}`);
      } else {
        console.log('\n❌ "Camión Externo" NO está en la respuesta del API');
        console.log('Transportadoras encontradas:', carriersResponse.data.data.map(c => c.name));
      }
    } else if (carriersResponse.data && Array.isArray(carriersResponse.data)) {
      console.log(`\n📊 Total transportadoras: ${carriersResponse.data.length}`);
      
      console.log('\n📋 LISTA DE TRANSPORTADORAS:');
      carriersResponse.data.forEach((carrier, idx) => {
        console.log(`${idx + 1}. ${carrier.name} (ID: ${carrier.id})`);
      });
    } else {
      console.log('\n❌ El endpoint no devolvió datos válidos');
      console.log('Estructura de respuesta:', carriersResponse.data);
    }

    console.log('\n🎉 CONCLUSIÓN: El endpoint está funcionando correctamente!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
    
    console.log('\n💡 POSIBLES CAUSAS:');
    console.log('1. El backend no está corriendo en el puerto 3001');
    console.log('2. El endpoint no está correctamente configurado');
    console.log('3. Hay un error en el controlador logisticsController.getCarriers');
  }
}

testPublicCarriersEndpoint();

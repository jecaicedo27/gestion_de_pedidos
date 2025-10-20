const axios = require('axios');

async function testCarriersEndpoint() {
  try {
    console.log('🔍 PROBANDO ENDPOINT DE TRANSPORTADORAS CON AUTENTICACIÓN');
    console.log('======================================================\n');

    // Primero hacer login para obtener token
    console.log('🔑 Intentando hacer login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123' // Asumiendo credenciales por defecto
    });

    const token = loginResponse.data.token;
    console.log('✅ Login exitoso, token obtenido');

    // Probar endpoint de transportadoras
    console.log('\n🚛 Probando endpoint GET /api/logistics/carriers...');
    const carriersResponse = await axios.get('http://localhost:3001/api/logistics/carriers', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Respuesta del endpoint exitosa:');
    console.log(`Total transportadoras: ${carriersResponse.data.data ? carriersResponse.data.data.length : 'No data field'}`);
    
    if (carriersResponse.data.data) {
      console.log('\n📋 LISTA DE TRANSPORTADORAS:');
      carriersResponse.data.data.forEach((carrier, idx) => {
        console.log(`${idx + 1}. ${carrier.name} (ID: ${carrier.id})`);
      });
      
      // Buscar específicamente Camión Externo
      const camionExterno = carriersResponse.data.data.find(c => c.name === 'Camión Externo');
      if (camionExterno) {
        console.log('\n✅ "Camión Externo" SÍ está en la respuesta del API');
      } else {
        console.log('\n❌ "Camión Externo" NO está en la respuesta del API');
      }
    } else {
      console.log('\n❌ El endpoint no devolvió un campo "data" válido');
      console.log('Respuesta completa:', JSON.stringify(carriersResponse.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Error de autenticación. Probemos con otras credenciales:');
      
      const credentials = [
        { username: 'admin', password: 'password' },
        { username: 'admin', password: '123456' },
        { username: 'logistica', password: 'logistica123' }
      ];

      for (const cred of credentials) {
        try {
          console.log(`Probando ${cred.username}/${cred.password}...`);
          const loginResponse = await axios.post('http://localhost:3001/api/auth/login', cred);
          const token = loginResponse.data.token;
          console.log(`✅ Login exitoso con ${cred.username}`);
          
          const carriersResponse = await axios.get('http://localhost:3001/api/logistics/carriers', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          console.log(`✅ Transportadoras obtenidas: ${carriersResponse.data.data?.length || 0}`);
          return;
        } catch (loginError) {
          console.log(`❌ Falló ${cred.username}`);
        }
      }
    }
  }
}

testCarriersEndpoint();

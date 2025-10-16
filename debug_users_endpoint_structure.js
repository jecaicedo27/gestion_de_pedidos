const axios = require('axios');

async function debugUsersEndpointStructure() {
  try {
    console.log('🔍 INVESTIGANDO ESTRUCTURA DEL ENDPOINT GET /api/users\n');

    // PASO 1: Hacer login como admin
    console.log('🔐 PASO 1: Login como admin');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');

    // PASO 2: Obtener lista de usuarios y analizar estructura
    console.log('\n📊 PASO 2: Analizando respuesta del endpoint GET /api/users');
    
    try {
      const usersResponse = await axios.get('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Endpoint funcionó correctamente');
      console.log('🔍 ESTRUCTURA COMPLETA DE LA RESPUESTA:');
      console.log(JSON.stringify(usersResponse.data, null, 2));
      
      console.log('\n📋 ANÁLISIS DE LA ESTRUCTURA:');
      console.log('- Tipo de usersResponse.data:', typeof usersResponse.data);
      console.log('- ¿Tiene propiedad success?:', 'success' in usersResponse.data);
      console.log('- ¿Tiene propiedad data?:', 'data' in usersResponse.data);
      
      if (usersResponse.data.data) {
        console.log('- Tipo de usersResponse.data.data:', typeof usersResponse.data.data);
        console.log('- ¿Es array?:', Array.isArray(usersResponse.data.data));
        
        if (Array.isArray(usersResponse.data.data)) {
          console.log('- Número de usuarios:', usersResponse.data.data.length);
          
          // Buscar mensajero1
          const mensajero1 = usersResponse.data.data.find(u => u.username === 'mensajero1');
          if (mensajero1) {
            console.log('\n🎯 MENSAJERO1 ENCONTRADO EN LA LISTA:');
            console.log(JSON.stringify(mensajero1, null, 2));
          } else {
            console.log('\n❌ MENSAJERO1 NO ENCONTRADO EN LA LISTA');
            console.log('Usuarios disponibles:', usersResponse.data.data.map(u => u.username));
          }
        }
      } else {
        console.log('❌ usersResponse.data.data no existe o es undefined');
        console.log('Propiedades disponibles:', Object.keys(usersResponse.data));
      }

    } catch (getUsersError) {
      console.log('❌ Error obteniendo lista de usuarios:');
      if (getUsersError.response) {
        console.log('Status:', getUsersError.response.status);
        console.log('Data:', getUsersError.response.data);
      } else {
        console.log('Error:', getUsersError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar la investigación
debugUsersEndpointStructure();

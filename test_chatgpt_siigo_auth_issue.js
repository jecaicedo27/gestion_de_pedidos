const axios = require('axios');

// Test para verificar el problema de autenticación con el endpoint ChatGPT SIIGO
async function testAuthenticationIssue() {
  console.log('🔍 Diagnosticando problema de autenticación ChatGPT SIIGO...\n');

  try {
    // Paso 1: Hacer login para obtener un token válido
    console.log('📝 PASO 1: Obteniendo token de autenticación...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      console.error('❌ Error en login:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data?.token || loginResponse.data.token;
    console.log('✅ Token obtenido exitosamente');
    
    if (token) {
      console.log('🔑 Token (primeros 50 caracteres):', token.substring(0, 50) + '...');
    } else {
      console.log('❌ Token no recibido en la respuesta');
      console.log('📄 Respuesta completa:', JSON.stringify(loginResponse.data, null, 2));
      return;
    }

    // Paso 2: Probar el endpoint con token válido
    console.log('\n📝 PASO 2: Probando endpoint ChatGPT SIIGO con token...');
    
    const testData = {
      customer_id: 1, // Using numeric customer ID instead of name
      natural_language_order: "5 sal limon de 250\n3 perlas de 360 fresa",
      notes: "Pedido de prueba creado via ChatGPT"
    };

    console.log('📊 Datos de prueba:', JSON.stringify(testData, null, 2));

    try {
      const response = await axios.post(
        'http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt',
        testData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('✅ Respuesta exitosa:', response.status);
      console.log('📄 Respuesta:', JSON.stringify(response.data, null, 2));

    } catch (apiError) {
      console.log('❌ Error en API:', apiError.response?.status, apiError.response?.statusText);
      
      if (apiError.response?.status === 401) {
        console.log('🔍 Error 401 - Problema de autenticación:');
        console.log('📄 Respuesta del servidor:', apiError.response.data);
        
        // Verificar si el token está siendo enviado correctamente
        console.log('\n🔍 Verificando headers de la petición...');
        console.log('Authorization header:', apiError.config.headers.Authorization ? 'PRESENTE' : 'AUSENTE');
      } else if (apiError.response?.status === 500) {
        console.log('🔍 Error 500 - Error interno del servidor:');
        console.log('📄 Respuesta del servidor:', apiError.response.data);
      } else {
        console.log('📄 Respuesta de error:', apiError.response?.data);
      }
    }

    // Paso 3: Verificar otros endpoints para comparar
    console.log('\n📝 PASO 3: Probando endpoint de comparación (customers search)...');
    
    try {
      const customersResponse = await axios.get(
        'http://localhost:3001/api/quotations/customers/search?q=JOHN',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Endpoint customers search funciona:', customersResponse.status);
      console.log('📊 Resultado:', `${customersResponse.data.length || 0} clientes encontrados`);

    } catch (customersError) {
      console.log('❌ Error en customers search:', customersError.response?.status);
      console.log('📄 Respuesta:', customersError.response?.data);
    }

    // Paso 4: Verificar el estado del token
    console.log('\n📝 PASO 4: Verificando validez del token...');
    
    try {
      const profileResponse = await axios.get(
        'http://localhost:3001/api/auth/profile',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('✅ Token válido - Usuario:', profileResponse.data.user?.username);
      console.log('👤 Rol:', profileResponse.data.user?.role);

    } catch (profileError) {
      console.log('❌ Token inválido:', profileError.response?.status);
      console.log('📄 Respuesta:', profileError.response?.data);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('🔌 El servidor no está ejecutándose en http://localhost:3001');
    }
  }
}

// Ejecutar el test
testAuthenticationIssue().catch(console.error);

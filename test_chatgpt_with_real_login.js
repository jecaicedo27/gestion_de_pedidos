const axios = require('axios');

console.log('🔐 Testing ChatGPT with Real Authentication');
console.log('==========================================');

const API_BASE = 'http://localhost:3001/api';

async function loginAndTestChatGPT() {
  try {
    // Paso 1: Login
    console.log('📋 1. Intentando login...');
    const loginData = {
      email: 'admin@admin.com',  // Usuario por defecto
      password: 'admin123'       // Contraseña por defecto
    };
    
    let token = null;
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, loginData, {
        timeout: 10000
      });
      
      if (loginResponse.data.success && loginResponse.data.token) {
        token = loginResponse.data.token;
        console.log('✅ Login exitoso');
        console.log('   Usuario:', loginResponse.data.user?.name || 'Admin');
        console.log('   Rol:', loginResponse.data.user?.role || 'admin');
      } else {
        console.log('❌ Login falló - respuesta sin token');
        return;
      }
    } catch (error) {
      console.log('❌ Login falló:', error.response?.data?.message || error.message);
      console.log('💡 Intentando con credenciales alternativas...');
      
      // Intentar con credenciales alternativas
      const altCredentials = [
        { email: 'admin@admin.com', password: 'admin' },
        { email: 'admin', password: 'admin123' },
        { email: 'admin', password: 'admin' },
        { email: 'usuario@admin.com', password: 'admin123' }
      ];
      
      for (const creds of altCredentials) {
        try {
          const altResponse = await axios.post(`${API_BASE}/auth/login`, creds, {
            timeout: 10000
          });
          
          if (altResponse.data.success && altResponse.data.token) {
            token = altResponse.data.token;
            console.log(`✅ Login exitoso con ${creds.email}`);
            break;
          }
        } catch (altError) {
          // Continuar con el siguiente
        }
      }
      
      if (!token) {
        console.log('❌ No se pudo obtener token de autenticación');
        console.log('💡 Sugerencia: Verifica que exista un usuario admin en la base de datos');
        return;
      }
    }
    
    // Paso 2: Test ChatGPT processing con token real
    console.log('\n📋 2. Testing ChatGPT processing con autenticación...');
    const testData = {
      description: "Necesito 2 kilos de arroz, 1 litro de aceite de girasol y 500 gramos de azúcar",
      customerInfo: "Cliente de prueba - Test ChatGPT"
    };
    
    try {
      const chatgptResponse = await axios.post(`${API_BASE}/quotations/process-with-chatgpt`, testData, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ ChatGPT processing funcionando correctamente!');
      console.log('📊 Respuesta ChatGPT:');
      console.log('   Status:', chatgptResponse.status);
      
      if (chatgptResponse.data) {
        console.log('   Datos procesados:', JSON.stringify(chatgptResponse.data, null, 2));
      }
      
    } catch (error) {
      console.log('❌ ChatGPT processing error:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Detalles del error:');
        console.log('  ', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Paso 3: Test endpoints relacionados con ChatGPT
    console.log('\n📋 3. Testing endpoints relacionados...');
    
    // Test quotations list
    try {
      const quotationsResponse = await axios.get(`${API_BASE}/quotations`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000
      });
      console.log('✅ Quotations list:', quotationsResponse.status);
      console.log('   Cotizaciones encontradas:', quotationsResponse.data?.data?.length || 0);
    } catch (error) {
      console.log('❌ Quotations list error:', error.response?.status || error.message);
    }
    
    // Test customer search
    try {
      const customerResponse = await axios.get(`${API_BASE}/quotations/customers/search?q=test`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000
      });
      console.log('✅ Customer search:', customerResponse.status);
    } catch (error) {
      console.log('❌ Customer search error:', error.response?.status || error.message);
    }
    
    // Test stats
    try {
      const statsResponse = await axios.get(`${API_BASE}/quotations/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000
      });
      console.log('✅ Quotations stats:', statsResponse.status);
    } catch (error) {
      console.log('❌ Quotations stats error:', error.response?.status || error.message);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

async function checkDatabaseConnection() {
  console.log('\n🔍 Verificando conexión a base de datos...');
  
  try {
    // Test any endpoint that requires DB
    const response = await axios.get(`${API_BASE}/config/public`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log('✅ Base de datos conectada correctamente');
    } else {
      console.log('❌ Posible problema con base de datos, status:', response.status);
    }
  } catch (error) {
    console.log('❌ Error de conexión a DB:', error.message);
  }
}

async function runFullTest() {
  await checkDatabaseConnection();
  await loginAndTestChatGPT();
  
  console.log('\n📊 CONCLUSIÓN:');
  console.log('==============');
  console.log('Si ves "ChatGPT processing funcionando correctamente", el problema está resuelto.');
  console.log('Si ves errores 401, necesitas loguearte en el frontend primero.');
  console.log('Si ves errores 500, hay problemas con la configuración de OpenAI API o base de datos.');
  console.log('\n🎯 PARA SOLUCIONARLO EN EL FRONTEND:');
  console.log('1. Abre el frontend en http://localhost:3000');
  console.log('2. Inicia sesión con tus credenciales');
  console.log('3. Ve a la página de Cotizaciones');
  console.log('4. Prueba la función "Procesar con ChatGPT"');
}

runFullTest().catch(error => {
  console.error('❌ Error ejecutando test:', error.message);
  process.exit(1);
});

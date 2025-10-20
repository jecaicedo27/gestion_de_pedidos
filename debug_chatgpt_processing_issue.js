const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🔍 DIAGNOSTICANDO PROBLEMA CON PROCESAMIENTO CHATGPT');
console.log('==================================================\n');

async function authenticateAndGetToken() {
  try {
    console.log('🔐 Intentando autenticación...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data && loginResponse.data.data && loginResponse.data.data.token) {
      const token = loginResponse.data.data.token;
      console.log('✅ Autenticación exitosa');
      return token;
    } else if (loginResponse.data && (loginResponse.data.token || loginResponse.data.access_token)) {
      const token = loginResponse.data.token || loginResponse.data.access_token;
      console.log('✅ Autenticación exitosa');
      return token;
    } else {
      console.log('❌ No se encontró token en la respuesta');
      console.log('   Response:', loginResponse.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error en autenticación:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
    return null;
  }
}

async function testBackendStatus() {
  try {
    console.log('🌐 Verificando estado del backend...');
    const response = await axios.get(`${BASE_URL}/api/config/public`);
    console.log('✅ Backend está ejecutándose');
    return true;
  } catch (error) {
    try {
      // Intenta con otra ruta que sabemos que funciona
      const response = await axios.get(`${BASE_URL}/api/siigo/invoices?page=1&page_size=1`);
      console.log('✅ Backend está ejecutándose (usando /api/siigo/invoices)');
      return true;
    } catch (error2) {
      console.log('❌ Backend no está respondiendo');
      console.log('   Error:', error.message);
      return false;
    }
  }
}

async function getValidCustomerId(token) {
  try {
    console.log('🔍 Buscando un cliente válido para la prueba...');
    const response = await axios.get(`${BASE_URL}/api/customers?page=1&page_size=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const customer = response.data.data[0];
      console.log(`✅ Cliente encontrado: ${customer.name || customer.commercial_name || customer.id}`);
      return customer.id;
    } else {
      console.log('⚠️  No se encontraron clientes, usando ID de prueba');
      return 1; // ID de prueba
    }
  } catch (error) {
    console.log('❌ Error buscando clientes, usando ID de prueba:', error.message);
    return 1; // ID de prueba como fallback
  }
}

async function testChatGPTProcessing(token) {
  console.log('\n📋 PROBANDO PROCESAMIENTO CHATGPT');
  console.log('================================');
  
  // Obtener un customer_id válido
  const customer_id = await getValidCustomerId(token);
  
  const testData = {
    customer_id: customer_id,
    natural_language_order: 'Necesito 10 unidades de liqui pop sabor fresa y 5 de sabor cola para la tienda',
    notes: 'Pedido de prueba generado por diagnóstico automático'
  };
  
  try {
    console.log('🤖 Enviando solicitud a ChatGPT...');
    console.log('   Datos:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(
      `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 30000 // 30 segundos de timeout
      }
    );
    
    console.log('✅ ChatGPT procesó correctamente');
    console.log('   Status:', response.status);
    console.log('   Response size:', JSON.stringify(response.data).length, 'caracteres');
    
    if (response.data) {
      console.log('   Estructura de respuesta:');
      console.log('   - Keys:', Object.keys(response.data));
      if (response.data.products) {
        console.log('   - Productos encontrados:', response.data.products.length);
      }
      if (response.data.customer) {
        console.log('   - Cliente:', response.data.customer.name || response.data.customer);
      }
    }
    
    return { success: true, data: response.data };
    
  } catch (error) {
    console.log('❌ Error en procesamiento ChatGPT');
    console.log('   Error:', error.message);
    
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Status Text:', error.response.statusText);
      
      if (error.response.data) {
        console.log('   Error Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Análisis específico de errores comunes
      if (error.response.status === 500) {
        console.log('   🔍 ERROR 500 - Problema interno del servidor');
        console.log('       Posibles causas:');
        console.log('       - Servicio ChatGPT no configurado correctamente');
        console.log('       - Error en base de datos');
        console.log('       - Credenciales de API faltantes');
      } else if (error.response.status === 422) {
        console.log('   🔍 ERROR 422 - Datos de entrada inválidos');
      } else if (error.response.status === 401) {
        console.log('   🔍 ERROR 401 - Token de autenticación inválido');
      } else if (error.response.status === 429) {
        console.log('   🔍 ERROR 429 - Límite de rate exceeded (ChatGPT)');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.log('   🔍 TIMEOUT - La solicitud tardó más de 30 segundos');
    }
    
    return { success: false, error: error.message, status: error.response?.status };
  }
}

async function testSimpleChatGPTEndpoint(token) {
  console.log('\n🧪 PROBANDO ENDPOINT SIMPLE DE CHATGPT');
  console.log('====================================');
  
  try {
    // Intenta un endpoint más simple si existe
    const response = await axios.get(`${BASE_URL}/api/config`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Configuración accesible');
    
    if (response.data && response.data.chatgpt) {
      console.log('   ChatGPT config encontrada:', !!response.data.chatgpt);
    }
    
  } catch (error) {
    console.log('❌ No se pudo acceder a configuración');
    console.log('   Error:', error.message);
  }
}

async function runDiagnostic() {
  console.log('⏰', new Date().toLocaleString());
  console.log('');
  
  // 1. Verificar backend
  const backendOk = await testBackendStatus();
  if (!backendOk) {
    console.log('\n❌ DIAGNÓSTICO DETENIDO - Backend no está ejecutándose');
    console.log('   Solución: Ejecutar "node start_backend.js" o reiniciar la aplicación');
    return;
  }
  
  // 2. Autenticarse
  const token = await authenticateAndGetToken();
  if (!token) {
    console.log('\n❌ DIAGNÓSTICO DETENIDO - No se pudo autenticar');
    return;
  }
  
  // 3. Probar endpoint simple
  await testSimpleChatGPTEndpoint(token);
  
  // 4. Probar ChatGPT processing
  const result = await testChatGPTProcessing(token);
  
  // 5. Resumen
  console.log('\n📊 RESUMEN DEL DIAGNÓSTICO');
  console.log('=========================');
  console.log('Backend:', backendOk ? '✅ OK' : '❌ FALLANDO');
  console.log('Autenticación:', token ? '✅ OK' : '❌ FALLANDO');
  console.log('ChatGPT Processing:', result.success ? '✅ OK' : '❌ FALLANDO');
  
  if (!result.success) {
    console.log('\n🔧 ACCIONES RECOMENDADAS:');
    if (result.status === 500) {
      console.log('1. Verificar variables de entorno (OPENAI_API_KEY)');
      console.log('2. Revisar logs del backend para errores específicos');
      console.log('3. Verificar conexión a base de datos');
    } else if (result.status === 422) {
      console.log('1. Verificar formato de datos de entrada');
      console.log('2. Revisar validaciones en el backend');
    } else {
      console.log('1. Reiniciar el backend completamente');
      console.log('2. Verificar configuración de ChatGPT');
    }
  }
}

runDiagnostic().catch(error => {
  console.error('❌ Error crítico en diagnóstico:', error.message);
});

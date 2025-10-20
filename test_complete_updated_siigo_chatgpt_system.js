const axios = require('axios');

console.log('🧪 PRUEBA COMPLETA DEL SISTEMA CHATGPT + SIIGO ACTUALIZADO');
console.log('='.repeat(70));

// Configuración de prueba
const testConfig = {
  backendUrl: 'http://localhost:3001',
  testCustomer: {
    id: 1,
    name: 'Cliente de Prueba',
    document: '12345678',
    email: 'test@example.com',
    siigo_id: null
  },
  testOrder: {
    customer_notes: 'Necesito 5 cajas de Liquipops sabor maracuyá y 3 de cereza',
    items: [
      {
        product_name: 'Liquipops Maracuyá',
        quantity: 5,
        unit_price: 2500,
        product_code: 'LIQUIPP01'
      },
      {
        product_name: 'Liquipops Cereza', 
        quantity: 3,
        unit_price: 2500,
        product_code: 'LIQUIPP02'
      }
    ]
  }
};

let authToken = null;

// Función para obtener token de autenticación
async function authenticate() {
  try {
    console.log('\n🔑 Obteniendo token de autenticación...');
    
    const response = await axios.post(`${testConfig.backendUrl}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });

    if (response.data.token) {
      authToken = response.data.token;
      console.log('✅ Token obtenido exitosamente');
      return true;
    } else {
      console.log('❌ No se recibió token en la respuesta');
      return false;
    }
  } catch (error) {
    console.log('❌ Error en autenticación:', error.message);
    return false;
  }
}

// Función para probar el endpoint de cotizaciones
async function testQuotationsEndpoint() {
  try {
    console.log('\n📋 Probando endpoint de cotizaciones...');
    
    const response = await axios.get(`${testConfig.backendUrl}/api/quotations`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Endpoint de cotizaciones respondió: ${response.status}`);
    console.log(`📊 Cotizaciones encontradas: ${response.data.length || 0}`);
    return true;
  } catch (error) {
    console.log(`❌ Error en endpoint de cotizaciones: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.log('📄 Detalles del error:', error.response.data);
    }
    return false;
  }
}

// Función para probar la creación de factura con ChatGPT
async function testChatGPTInvoiceCreation() {
  try {
    console.log('\n🤖 Probando creación de factura con ChatGPT...');
    
    const requestData = {
      customer_id: testConfig.testCustomer.id,
      customer_notes: testConfig.testOrder.customer_notes,
      quotation_notes: 'Factura de prueba generada automáticamente'
    };

    console.log('📤 Datos de la solicitud:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(
      `${testConfig.backendUrl}/api/quotations/create-siigo-invoice-with-chatgpt`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 segundos para ChatGPT
      }
    );

    console.log('✅ Respuesta de creación de factura recibida');
    console.log('📊 Status:', response.status);
    console.log('📄 Respuesta completa:', JSON.stringify(response.data, null, 2));

    // Verificar estructura de respuesta
    if (response.data.chatgpt_response) {
      console.log('✅ ChatGPT response incluida en la respuesta');
      console.log('🤖 Respuesta de ChatGPT:', response.data.chatgpt_response.substring(0, 200) + '...');
    }

    if (response.data.siigo_result) {
      console.log('✅ Resultado de SIIGO incluido en la respuesta');
      console.log('🏢 Resultado de SIIGO:', JSON.stringify(response.data.siigo_result, null, 2));
    }

    if (response.data.quotation_id) {
      console.log('✅ ID de cotización generado:', response.data.quotation_id);
    }

    return response.data;
  } catch (error) {
    console.log(`❌ Error en creación de factura con ChatGPT: ${error.response?.status || error.message}`);
    
    if (error.response?.data) {
      console.log('📄 Detalles del error:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Si hay errores específicos, mostrar sugerencias
    if (error.message.includes('timeout')) {
      console.log('💡 Sugerencia: El timeout puede indicar que ChatGPT está tardando más de 60s');
    }
    
    if (error.response?.status === 500) {
      console.log('💡 Sugerencia: Verificar variables de entorno (OPENAI_API_KEY, CUSTOM_GPT_ASSISTANT_ID, SIIGO_API_TOKEN)');
    }

    return null;
  }
}

// Función para verificar el estado del backend
async function checkBackendHealth() {
  try {
    console.log('\n🏥 Verificando estado del backend...');
    
    // Intentar autenticación directa ya que no hay endpoint /health
    const response = await axios.post(`${testConfig.backendUrl}/api/auth/login`, {
      username: 'test',
      password: 'test'
    });
    
    console.log('✅ Backend está funcionando (verificado via auth endpoint)');
    return true;
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 400)) {
      console.log('✅ Backend está funcionando (endpoint auth respondió correctamente con error esperado)');
      return true;
    }
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend no está respondiendo - conexión rechazada');
      console.log('💡 Asegúrate de que el backend esté ejecutándose en el puerto 3001');
      return false;
    }
    console.log('⚠️ Backend respondió con error:', error.response?.status || error.message);
    console.log('✅ Pero esto indica que el backend está ejecutándose, continuando...');
    return true;
  }
}

// Función para verificar variables de entorno críticas
async function checkEnvironmentVariables() {
  try {
    console.log('\n🔧 Verificando variables de entorno...');
    
    // Verificar a través del endpoint de configuración si existe
    const response = await axios.get(`${testConfig.backendUrl}/api/config/check`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Estado de configuración:', response.data);
    return response.data;
  } catch (error) {
    console.log('⚠️  No se pudo verificar las variables de entorno a través de API');
    console.log('💡 Variables críticas que deben estar configuradas:');
    console.log('   - OPENAI_API_KEY');
    console.log('   - CUSTOM_GPT_ASSISTANT_ID');
    console.log('   - SIIGO_API_TOKEN');
    console.log('   - SIIGO_USERNAME');
    console.log('   - SIIGO_ACCESS_KEY');
    return null;
  }
}

// Función principal de prueba
async function runCompleteTest() {
  console.log('🚀 Iniciando pruebas completas...\n');

  // 1. Verificar que el backend esté funcionando
  const backendHealthy = await checkBackendHealth();
  if (!backendHealthy) {
    console.log('\n❌ PRUEBA FALLIDA: Backend no está disponible');
    return;
  }

  // 2. Autenticarse
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('\n❌ PRUEBA FALLIDA: No se pudo autenticar');
    return;
  }

  // 3. Verificar variables de entorno
  await checkEnvironmentVariables();

  // 4. Probar endpoint básico de cotizaciones
  const quotationsWorking = await testQuotationsEndpoint();
  if (!quotationsWorking) {
    console.log('\n⚠️  Endpoint de cotizaciones tiene problemas, pero continuando...');
  }

  // 5. Probar creación de factura con ChatGPT (prueba principal)
  const result = await testChatGPTInvoiceCreation();

  // 6. Mostrar resumen de resultados
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE RESULTADOS:');
  console.log('='.repeat(70));
  
  if (result) {
    console.log('✅ ÉXITO: El sistema ChatGPT + SIIGO está funcionando');
    console.log('✅ Se puede crear facturas usando procesamiento de ChatGPT');
    console.log('✅ La respuesta de ChatGPT se está capturando correctamente');
    
    if (result.chatgpt_response) {
      console.log('✅ ChatGPT response disponible para mostrar en interfaz');
    }
    
    if (result.siigo_result && result.siigo_result.success) {
      console.log('✅ Factura creada exitosamente en SIIGO');
    } else if (result.siigo_result) {
      console.log('⚠️  Factura procesada pero con posibles errores en SIIGO');
      console.log('📄 Detalles:', result.siigo_result.message || 'Ver logs para más detalles');
    }
  } else {
    console.log('❌ FALLO: El sistema tiene problemas que requieren atención');
    console.log('🔍 Revisar los errores anteriores para diagnóstico');
  }

  console.log('\n🎯 PRÓXIMOS PASOS PARA EL FRONTEND:');
  console.log('-'.repeat(40));
  console.log('1. Verificar que QuotationsPage.js esté mostrando chatgpt_response');
  console.log('2. Confirmar que el cuadro de texto con resultado de ChatGPT es visible');
  console.log('3. Probar el flujo completo desde la interfaz web');
  console.log('4. Verificar que se muestren las facturas creadas en la lista');

  console.log('\n✅ PRUEBA COMPLETA FINALIZADA');
}

// Ejecutar las pruebas
runCompleteTest().catch(error => {
  console.error('❌ Error fatal en las pruebas:', error.message);
  process.exit(1);
});

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testChatGPTCompleteFlow() {
  console.log('=== Probando Flujo Completo de ChatGPT ===\n');
  
  try {
    // 1. Login
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: '1751'
    });
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso\n');

    // 2. Probar procesamiento con ChatGPT
    console.log('2. Probando procesamiento con ChatGPT...');
    const naturalOrder = "2 liquipops de fresa y 3 de mango";
    
    const chatgptResponse = await axios.post(
      `${API_URL}/quotations/process-chatgpt`,
      { natural_language_order: naturalOrder },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ ChatGPT procesó exitosamente:');
    console.log('   - Processing ID:', chatgptResponse.data.processingId);
    console.log('   - Productos detectados:', chatgptResponse.data.processedOrder.products.length);
    console.log('   - Respuesta:', JSON.stringify(chatgptResponse.data.processedOrder, null, 2));
    
    // 3. Verificar que se puede crear cotización
    console.log('\n3. Verificando estructura para cotización...');
    const processedOrder = chatgptResponse.data.processedOrder;
    
    if (processedOrder.products && processedOrder.products.length > 0) {
      console.log('✅ Estructura lista para crear cotización:');
      processedOrder.products.forEach(p => {
        console.log(`   - ${p.name}: ${p.quantity} unidades`);
      });
    }
    
    // 4. Probar búsqueda de clientes
    console.log('\n4. Probando búsqueda de clientes...');
    const customersResponse = await axios.get(
      `${API_URL}/customers/search?q=prueba`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log(`✅ Búsqueda de clientes funciona: ${customersResponse.data.length} clientes encontrados`);
    
    // 5. Verificar endpoint de cotizaciones
    console.log('\n5. Verificando endpoint de cotizaciones...');
    const quotationsResponse = await axios.get(
      `${API_URL}/quotations`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log(`✅ Endpoint de cotizaciones funciona: ${quotationsResponse.data.quotations.length} cotizaciones existentes`);
    
    console.log('\n✅ TODOS LOS COMPONENTES DEL FLUJO CHATGPT FUNCIONAN CORRECTAMENTE');
    console.log('\nPuedes proceder a:');
    console.log('1. Ingresar a http://localhost:3000');
    console.log('2. Ir a la página de Cotizaciones');
    console.log('3. Escribir un pedido en lenguaje natural');
    console.log('4. Hacer clic en "Procesar con ChatGPT"');
    console.log('5. Seleccionar un cliente');
    console.log('6. Crear la factura FV-1 o FV-2');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n⚠️ Error de autenticación. Verificando estado del backend...');
    } else if (error.response?.status === 500) {
      console.log('\n⚠️ Error del servidor. Detalles:', error.response?.data);
    }
  }
}

testChatGPTCompleteFlow();
